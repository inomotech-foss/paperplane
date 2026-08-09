# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from datetime import datetime, timezone
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from plane.db.models import FileAsset, Page, Project, User, WorkspaceMember
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
        "id": "103",
        "title": "Diagrams and Files",
        "parentId": "100",
        "authorId": "acct-ada",
        "createdAt": "2023-04-01T08:00:00.000Z",
        "version": {"number": 1, "createdAt": "2023-04-01T08:00:00.000Z"},
        "body": {
            "storage": {
                "value": (
                    '<ac:image><ri:attachment ri:filename="shot.png"/></ac:image>'
                    '<p><ac:link><ri:attachment ri:filename="spec.pdf"/></ac:link></p>'
                    '<ac:structured-macro ac:name="drawio">'
                    '<ac:parameter ac:name="diagramName">Flow.drawio</ac:parameter>'
                    '<ac:parameter ac:name="width">800</ac:parameter></ac:structured-macro>'
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


ATTACHMENTS = {
    "shot.png": b"\x89PNG\r\n\x1a\n",
    "spec.pdf": b"%PDF-1.4",
    "Flow.drawio": b"<mxfile></mxfile>",
    "Flow.drawio.png": b"\x89PNG\r\n\x1a\n",
    # draw.io working copy: present in every real backup, never an attachment.
    "~Flow.drawio.tmp": b"<mxfile></mxfile>",
    # No mime type, so it cannot be stored.
    "notes.zzz": b"junk",
}


class FakeStorage:
    """Records uploads instead of talking to S3."""

    def __init__(self):
        self.uploaded = {}

    def upload_file(self, file_obj, object_name, content_type=None):
        self.uploaded[object_name] = content_type
        return True


@pytest.fixture(autouse=True)
def storage(monkeypatch):
    """Patched in rather than injected so the management command, which builds
    its own loader, never reaches S3 either."""
    fake = FakeStorage()
    monkeypatch.setattr("plane.importers.confluence.assets.S3Storage", lambda *args, **kwargs: fake)
    return fake


@pytest.fixture
def backup_dir(tmp_path):
    space_dir = tmp_path / "confluence" / "IMS"
    space_dir.mkdir(parents=True)
    (space_dir / "space.json").write_text(json.dumps(SPACE))
    (space_dir / "pages.jsonl").write_text("\n".join(json.dumps(page) for page in PAGES))
    (tmp_path / "user_mapping.json").write_text(json.dumps([{"accountId": "acct-ada", "displayName": "Ada Lovelace"}]))

    attachment_dir = space_dir / "attachments" / "103"
    attachment_dir.mkdir(parents=True)
    for filename, content in ATTACHMENTS.items():
        (attachment_dir / filename).write_bytes(content)

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

        assert summary.created == 4
        pages = {page.name: page for page in Page.objects.all()}
        assert set(pages) == {"Quality Processes", "Test Plan", "Diagrams and Files", "Orphan"}
        assert pages["Test Plan"].parent_id == pages["Quality Processes"].id
        assert pages["Quality Processes"].parent_id is None
        # A parent outside the space becomes a root rather than being dropped.
        assert pages["Orphan"].parent_id is None

    def test_preserves_the_original_author(self, loader, ada, create_user):
        summary = loader.run()

        assert Page.objects.get(name="Test Plan").owned_by_id == ada.id
        assert summary.attributed == 3
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

    def test_records_chrome_apart_from_losses(self, loader, ada):
        summary = loader.run()

        assert summary.dropped_chrome == {"change-history": 1}
        assert summary.unsupported_macros == {}

    def test_rerun_updates_in_place(self, loader, ada):
        first = loader.run()
        second = loader.run()

        assert second.created == 0
        assert second.updated == 4
        assert second.project_id == first.project_id
        assert Page.objects.count() == 4
        assert Project.objects.count() == 1

    def test_rerun_picks_up_converter_improvements(self, loader, ada, backup_dir):
        loader.run()
        page = Page.objects.get(name="Orphan")
        Page.objects.filter(pk=page.pk).update(description_html="<p>stale</p>")

        loader.run()

        assert Page.objects.get(name="Orphan").description_html != "<p>stale</p>"

    def test_dry_run_writes_nothing(self, loader, ada):
        summary = loader.run(dry_run=True)

        assert summary.created == 4
        assert Page.objects.count() == 0
        assert Project.objects.count() == 0

    def test_uploads_attachments_and_skips_working_copies(self, loader, ada, storage):
        summary = loader.run()

        page = Page.objects.get(name="Diagrams and Files")
        stored = {asset.attributes["name"]: asset for asset in FileAsset.objects.filter(page=page)}
        assert set(stored) == {"shot.png", "spec.pdf", "Flow.drawio", "Flow.drawio.png"}
        assert summary.attachments == 4
        assert len(storage.uploaded) == 4
        assert summary.unsupported_attachments == {"notes.zzz"}

    def test_inline_files_and_real_attachments_are_told_apart(self, loader, ada):
        loader.run()

        page = Page.objects.get(name="Diagrams and Files")
        kinds = {asset.attributes["name"]: asset.entity_type for asset in FileAsset.objects.filter(page=page)}
        # The attachments tab lists documents and the editable diagram source.
        assert kinds["spec.pdf"] == FileAsset.EntityTypeContext.PAGE_ATTACHMENT
        assert kinds["Flow.drawio"] == FileAsset.EntityTypeContext.PAGE_ATTACHMENT
        # What the body draws itself is editor content, not a listed file.
        assert kinds["shot.png"] == FileAsset.EntityTypeContext.PAGE_DESCRIPTION
        assert kinds["Flow.drawio.png"] == FileAsset.EntityTypeContext.PAGE_DESCRIPTION

    def test_drawio_files_get_a_usable_mime_type(self, loader, ada, storage):
        loader.run()

        assert "application/xml" in storage.uploaded.values()

    def test_images_resolve_instead_of_becoming_placeholders(self, loader, ada):
        summary = loader.run()

        page = Page.objects.get(name="Diagrams and Files")
        image = FileAsset.objects.get(page=page, attributes__name="shot.png")
        assert f'src="{image.id}"' in page.description_html
        assert "[image]" not in page.description_html
        assert "[shot.png]" not in page.description_html
        assert summary.unresolved_attachments == set()

    def test_diagrams_resolve_to_both_halves_of_the_pair(self, loader, ada):
        loader.run()

        page = Page.objects.get(name="Diagrams and Files")
        source = FileAsset.objects.get(page=page, attributes__name="Flow.drawio")
        preview = FileAsset.objects.get(page=page, attributes__name="Flow.drawio.png")
        assert f'asset_id="{source.id}"' in page.description_html
        assert f'preview_asset_id="{preview.id}"' in page.description_html
        assert 'width="800"' in page.description_html

    def test_attachment_links_point_at_the_download_route(self, loader, ada):
        loader.run()

        page = Page.objects.get(name="Diagrams and Files")
        pdf = FileAsset.objects.get(page=page, attributes__name="spec.pdf")
        assert f"/pages/{page.id}/attachments/{pdf.id}/" in page.description_html

    def test_rerun_reuses_assets_rather_than_uploading_again(self, loader, ada, storage):
        loader.run()
        storage.uploaded.clear()

        summary = loader.run()

        assert storage.uploaded == {}
        assert summary.attachments == 4
        assert FileAsset.objects.filter(page__name="Diagrams and Files").count() == 4

    def test_dry_run_uploads_nothing(self, loader, ada, storage):
        """S3 writes are outside the transaction, so a rolled-back run that had
        uploaded would leave objects behind with no rows pointing at them."""
        summary = loader.run(dry_run=True)

        assert storage.uploaded == {}
        assert summary.attachments_skipped is True
        assert FileAsset.objects.count() == 0

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

        assert Page.objects.count() == 4
        assert "4 created, 0 updated" in output
        assert "attributed  3/4" in output
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
