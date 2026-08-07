# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from datetime import datetime, timezone
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from plane.db.models import Page, Project, User, WorkspaceMember
from plane.importers.confluence.backup import ConfluenceBackup
from plane.importers.confluence.loader import ConfluenceLoader

SPACE = {
    "id": "20742223",
    "key": "IMS",
    "name": "Integrated Management System (IMS)",
}

PAGES = [
    {
        "id": "100",
        "title": "Quality Processes",
        "parentId": "None",
        "authorId": "acct-ada",
        "createdAt": "2022-10-27T19:11:16.458Z",
        "version": {"number": 5, "createdAt": "2022-11-06T21:56:58.764Z", "authorId": "acct-ada"},
        "body": {"storage": {"value": "<p>Root page</p>"}},
    },
    {
        "id": "101",
        "title": "Test Plan",
        "parentId": "100",
        "authorId": "acct-ada",
        "createdAt": "2023-01-15T08:00:00.000Z",
        "version": {"number": 2, "createdAt": "2023-02-01T08:00:00.000Z"},
        "body": {
            "storage": {
                "value": (
                    '<p><ac:link><ri:user ri:account-id="acct-ada"/></ac:link> owns this.</p>'
                    '<p><ac:link><ri:page ri:content-title="Quality Processes"/>'
                    "<ac:link-body>parent</ac:link-body></ac:link></p>"
                )
            }
        },
    },
    {
        "id": "102",
        "title": "Orphan",
        # Parent outside the space: must still import, as a root.
        "parentId": "999999",
        "authorId": "acct-ghost",
        "createdAt": "2023-03-01T08:00:00.000Z",
        "version": {"number": 1, "createdAt": "2023-03-01T08:00:00.000Z"},
        "body": {"storage": {"value": '<ac:structured-macro ac:name="change-history"/>'}},
    },
]


@pytest.fixture
def backup_dir(tmp_path):
    space_dir = tmp_path / "confluence" / "IMS"
    space_dir.mkdir(parents=True)
    (space_dir / "space.json").write_text(json.dumps(SPACE))
    (space_dir / "pages.jsonl").write_text("\n".join(json.dumps(page) for page in PAGES))
    (tmp_path / "user_mapping.json").write_text(json.dumps([{"accountId": "acct-ada", "displayName": "Ada Lovelace"}]))
    return tmp_path


@pytest.fixture
def ada(db, workspace):
    user = User.objects.create(
        email="ada@plane.so",
        username="ada",
        first_name="Ada",
        last_name="Lovelace",
        display_name="Ada Lovelace",
    )
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
    return user


@pytest.fixture
def loader(workspace, create_user, backup_dir):
    return ConfluenceLoader(workspace.slug, create_user, ConfluenceBackup(backup_dir, "IMS"))


@pytest.mark.contract
@pytest.mark.django_db
class TestConfluenceImport:
    def test_creates_a_project_with_a_valid_name(self, loader, ada):
        summary = loader.run()

        project = Project.objects.get(id=summary.project_id)
        assert project.name == "Wiki Integrated Management System (IMS)"
        assert project.identifier == "IMS"
        assert project.external_source == "confluence"

    def test_imports_every_page_with_the_hierarchy(self, loader, ada):
        summary = loader.run()

        assert summary.created == 3
        pages = {page.name: page for page in Page.objects.all()}
        assert set(pages) == {"Quality Processes", "Test Plan", "Orphan"}
        assert pages["Test Plan"].parent_id == pages["Quality Processes"].id
        assert pages["Quality Processes"].parent_id is None
        # A parent outside the space becomes a root rather than being dropped.
        assert pages["Orphan"].parent_id is None

    def test_preserves_the_original_author(self, loader, ada, create_user):
        summary = loader.run()

        assert Page.objects.get(name="Test Plan").owned_by_id == ada.id
        assert summary.attributed == 2
        # Unmatched Confluence accounts fall back to the actor and are listed.
        assert Page.objects.get(name="Orphan").owned_by_id == create_user.id
        assert summary.unmapped_authors == {"acct-ghost"}

    def test_preserves_the_original_timestamps(self, loader, ada):
        loader.run()

        page = Page.objects.get(name="Quality Processes")
        assert page.created_at == datetime(2022, 10, 27, 19, 11, 16, 458000, tzinfo=timezone.utc)
        assert page.updated_at == datetime(2022, 11, 6, 21, 56, 58, 764000, tzinfo=timezone.utc)

    def test_rewrites_internal_links_to_plane_urls(self, loader, ada):
        summary = loader.run()

        parent_id = Page.objects.get(name="Quality Processes").id
        body = Page.objects.get(name="Test Plan").description_html
        assert f"/pages/{parent_id}/" in body
        assert summary.unresolved_pages == set()

    def test_converts_mentions(self, loader, ada):
        loader.run()

        body = Page.objects.get(name="Test Plan").description_html
        assert f'entity_identifier="{ada.id}"' in body

    def test_records_unsupported_macros(self, loader, ada):
        summary = loader.run()

        assert summary.unsupported_macros == {"change-history": 1}

    def test_rerun_updates_in_place(self, loader, ada):
        first = loader.run()
        second = loader.run()

        assert second.created == 0
        assert second.updated == 3
        assert second.project_id == first.project_id
        assert Page.objects.count() == 3
        assert Project.objects.count() == 1

    def test_rerun_picks_up_converter_improvements(self, loader, ada, backup_dir):
        loader.run()
        page = Page.objects.get(name="Orphan")
        Page.objects.filter(pk=page.pk).update(description_html="<p>stale</p>")

        loader.run()

        assert Page.objects.get(name="Orphan").description_html != "<p>stale</p>"

    def test_dry_run_writes_nothing(self, loader, ada):
        summary = loader.run(dry_run=True)

        assert summary.created == 3
        assert Page.objects.count() == 0
        assert Project.objects.count() == 0

    def test_bodies_are_sanitised(self, workspace, create_user, backup_dir, ada):
        space_dir = backup_dir / "confluence" / "IMS"
        hostile = dict(PAGES[0], id="200", title="Hostile")
        hostile["body"] = {"storage": {"value": '<p onclick="alert(1)">x</p><script>alert(1)</script>'}}
        space_dir.joinpath("pages.jsonl").write_text("\n".join(json.dumps(page) for page in [*PAGES, hostile]))

        ConfluenceLoader(workspace.slug, create_user, ConfluenceBackup(backup_dir, "IMS")).run()

        body = Page.objects.get(name="Hostile").description_html
        assert "script" not in body
        assert "onclick" not in body


@pytest.mark.contract
@pytest.mark.django_db
class TestImportCommand:
    def run(self, directory, target_workspace, target_actor, **overrides):
        output = StringIO()
        options = {
            "space": "IMS",
            "backup_dir": str(directory),
            "workspace": target_workspace.slug,
            "actor": target_actor.email,
            **overrides,
        }
        call_command("import_confluence", stdout=output, **options)
        return output.getvalue()

    def test_imports_and_reports(self, backup_dir, workspace, create_user, ada):
        output = self.run(backup_dir, workspace, create_user)

        assert Page.objects.count() == 3
        assert "3 created, 0 updated" in output
        assert "attributed  2/3" in output
        assert "change-history" in output

    def test_dry_run_is_reported_and_rolled_back(self, backup_dir, workspace, create_user, ada):
        output = self.run(backup_dir, workspace, create_user, dry_run=True)

        assert "dry run, rolled back" in output
        assert Page.objects.count() == 0

    @pytest.mark.parametrize(
        "overrides",
        [{"space": "NOPE"}, {"workspace": "no-such-workspace"}, {"actor": "nobody@plane.so"}],
    )
    def test_bad_arguments_fail_loudly(self, backup_dir, workspace, create_user, overrides):
        with pytest.raises(CommandError):
            self.run(backup_dir, workspace, create_user, **overrides)
