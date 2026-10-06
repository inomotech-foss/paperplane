# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

import pytest
from django.utils import timezone

from plane.db.models import Page, PageVersion, Project, ProjectMember, User, WorkspaceMember
from plane.importers.confluence.backup import SORT_STEP, ConfluenceBackup
from plane.importers.confluence.loader import PLACEHOLDER_HTML, Change, ConfluenceLoader
from plane.importers.users import UserRules

OWNER = {"accountId": "acc-owner", "displayName": "Space Owner", "emailAddress": "owner@plane.so"}
SPACE = {"id": "100", "key": "DEMO", "name": "Demo", "type": "global", "status": "current", "spaceOwnerId": "acc-owner"}


def record(page_id, title, parent=None, parent_type="page", position=0, status="current", body="<p>Hello</p>"):
    return {
        "id": page_id,
        "title": title,
        "parentId": parent,
        "parentType": parent_type if parent else None,
        "position": position,
        "status": status,
        "createdAt": "2024-01-01T10:00:00Z",
        "version": {"number": 1, "createdAt": "2024-02-01T10:00:00Z"},
        "body": {"storage": {"value": body}},
    }


PAGES = [
    record("10", "Home"),
    record("11", "Second", parent="10", position=20),
    record("12", "First", parent="10", position=10),
    record("13", "In folder", parent="99", parent_type="folder", position=1),
    record("14", "Old", parent="10", position=30, status="archived"),
]


def write_backup(root, space=SPACE, pages=PAGES):
    space_dir = root / "confluence" / space["key"]
    space_dir.mkdir(parents=True, exist_ok=True)
    (space_dir / "space.json").write_text(json.dumps(space))
    (space_dir / "pages.jsonl").write_text("\n".join(json.dumps(page) for page in pages) + "\n")
    (root / "user_mapping.json").write_text(json.dumps([OWNER]))
    return ConfluenceBackup(root, space["key"])


@pytest.fixture
def owner(workspace):
    user = User.objects.create(username="space-owner", email=OWNER["emailAddress"], display_name="Space Owner")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
    return user


@pytest.fixture
def loader(workspace, create_user, owner, tmp_path):
    # No page has attachments, so the storage is never touched.
    return ConfluenceLoader(workspace.slug, create_user, write_backup(tmp_path), storage=object())


def by_external_id(external_id):
    return Page.objects.get(external_source="confluence", external_id=external_id)


@pytest.mark.unit
@pytest.mark.django_db
class TestStructure:
    def test_folder_becomes_a_placeholder_parent(self, loader):
        summary = loader.run()

        folder = by_external_id("folder-99")
        assert folder.parent is None
        assert folder.name == "Folder 99"
        assert folder.description_html == PLACEHOLDER_HTML
        assert by_external_id("13").parent_id == folder.id
        assert summary.containers == 1

    def test_siblings_get_their_confluence_order(self, loader):
        loader.run()

        first, second, old = (by_external_id(page_id).sort_order for page_id in ("12", "11", "14"))
        assert (first, second, old) == (SORT_STEP, 2 * SORT_STEP, 3 * SORT_STEP)

    def test_archived_page_is_archived(self, loader):
        summary = loader.run()

        assert by_external_id("14").archived_at is not None
        assert by_external_id("10").archived_at is None
        assert summary.archived == 1

    def test_space_owner_becomes_project_admin(self, loader, owner):
        summary = loader.run()

        project = Project.objects.get(external_source="confluence", external_id="100")
        assert ProjectMember.objects.get(project=project, member=owner).role == 20
        assert summary.owner_granted is True

    def test_unmatched_owner_is_reported(self, workspace, create_user, tmp_path):
        loader = ConfluenceLoader(workspace.slug, create_user, write_backup(tmp_path), storage=object())

        assert loader.run().unmatched_accounts == {"Space Owner"}

    def test_owner_matched_through_a_domain_rule(self, workspace, create_user, tmp_path):
        user = User.objects.create(username="moved-owner", email="owner@new.example")
        WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
        rules = UserRules(domains={"plane.so": "new.example"})
        loader = ConfluenceLoader(
            workspace.slug, create_user, write_backup(tmp_path), storage=object(), user_rules=rules
        )

        summary = loader.run()

        assert ProjectMember.objects.get(project_id=summary.project_id, member=user).role == 20
        assert not summary.unmatched_accounts

    def test_archived_space_starts_archived(self, workspace, create_user, owner, tmp_path):
        backup = write_backup(tmp_path, space={**SPACE, "status": "archived"})

        ConfluenceLoader(workspace.slug, create_user, backup, storage=object()).run()

        assert Project.objects.get(external_source="confluence", external_id="100").archived_at is not None


@pytest.mark.unit
@pytest.mark.django_db
class TestLocalEdits:
    def test_an_edited_page_keeps_its_title_and_body(self, loader):
        loader.run()
        Page.objects.filter(pk=by_external_id("12").pk).update(
            name="Mine", description_html="<p>mine</p>", updated_at=timezone.now()
        )

        summary = loader.run()

        edited = by_external_id("12")
        assert (edited.name, edited.description_html) == ("Mine", "<p>mine</p>")
        assert edited.updated_at > by_external_id("11").updated_at
        assert summary.locally_edited == 1

    def test_an_edited_page_still_follows_the_backup_structure(self, loader):
        loader.run()
        Page.objects.filter(pk=by_external_id("12").pk).update(parent=None, sort_order=1, updated_at=timezone.now())

        loader.run()

        edited = by_external_id("12")
        assert (edited.parent_id, edited.sort_order) == (by_external_id("10").id, SORT_STEP)

    def test_structure_only_rewrites_no_existing_body(self, loader, tmp_path):
        loader.run()
        page = by_external_id("11")
        Page.objects.filter(pk=page.pk).update(description_html="<p>changed</p>", updated_at=page.updated_at)
        write_backup(tmp_path, pages=PAGES + [record("15", "New", parent="10", position=40)])

        loader.run(structure_only=True)

        assert by_external_id("11").description_html == "<p>changed</p>"
        assert "Hello" in by_external_id("15").description_html

    def test_rewriting_a_body_drops_the_stale_binary_document(self, loader):
        loader.run()
        page = by_external_id("11")
        Page.objects.filter(pk=page.pk).update(description_binary=b"opened", updated_at=page.updated_at)

        loader.run()

        assert by_external_id("11").description_binary is None

    def test_a_save_that_changed_no_words_is_not_an_edit(self, loader):
        """The editor rewrites markup and bumps the timestamp just by saving."""
        loader.run()
        Page.objects.filter(pk=by_external_id("11").pk).update(
            description_html="<p class='x'>Hello&#xFE0F;</p>", description_binary=b"opened", updated_at=timezone.now()
        )

        summary = loader.run()

        page = by_external_id("11")
        assert page.description_html == "<p>Hello</p>"
        assert page.description_binary is None
        assert summary.kept == 0

    def test_changed_words_are_kept(self, loader):
        loader.run()
        Page.objects.filter(pk=by_external_id("11").pk).update(
            description_html="<p>Hello</p><p>Mine</p>", description_binary=b"edited", updated_at=timezone.now()
        )

        summary = loader.run()

        page = by_external_id("11")
        assert page.description_html == "<p>Hello</p><p>Mine</p>"
        assert bytes(page.description_binary) == b"edited"
        assert summary.kept == 1
        assert Change("keep", "Second", "+1 -0 lines, id 11") in summary.changes

    def test_a_page_nobody_saved_follows_the_backup(self, loader):
        """Differing text alone is a converter change, not an edit."""
        loader.run()
        page = by_external_id("11")
        Page.objects.filter(pk=page.pk).update(description_html="<p>Old converter</p>", updated_at=page.updated_at)

        summary = loader.run()

        assert by_external_id("11").description_html == "<p>Hello</p>"
        assert summary.kept == 0

    def test_imported_history_is_never_rewritten(self, loader):
        loader.run()
        page = by_external_id("11")
        PageVersion.objects.filter(page_id=page.pk).delete()
        Page.objects.filter(pk=page.pk).update(description_html="<p>Rev 1</p>", updated_at=page.updated_at)
        old = PageVersion.objects.create(
            workspace=page.workspace, page_id=page.pk, owned_by_id=page.owned_by_id, description_html="<p>Rev 1</p>"
        )

        loader.run()

        assert by_external_id("11").description_html == "<p>Hello</p>"
        assert PageVersion.objects.filter(page_id=page.pk).count() == 1
        assert PageVersion.objects.get(pk=old.pk).description_html == "<p>Rev 1</p>"

    def test_take_overwrites_a_kept_page(self, loader):
        loader.run()
        Page.objects.filter(pk=by_external_id("11").pk).update(
            description_html="<p>Mine</p>", updated_at=timezone.now()
        )

        summary = loader.run(take=["11"])

        assert "Hello" in by_external_id("11").description_html
        assert summary.kept == 0

    def test_plan_writes_a_diff_per_kept_page(self, loader, tmp_path):
        loader.run()
        Page.objects.filter(pk=by_external_id("11").pk).update(
            description_html="<p>Hello</p><p>Mine</p>", updated_at=timezone.now()
        )

        loader.run(dry_run=True, diff_dir=tmp_path / "diffs")

        diff = (tmp_path / "diffs" / "DEMO-11.diff").read_text()
        assert diff.startswith("Second\n")
        assert "+Mine" in diff


@pytest.mark.unit
@pytest.mark.django_db
class TestDeletions:
    def test_a_page_deleted_in_plane_stays_deleted(self, loader):
        loader.run()
        by_external_id("11").delete()

        summary = loader.run()

        assert not Page.objects.filter(external_source="confluence", external_id="11").exists()
        assert summary.skipped_deleted == 1
        assert Change("skip", "Second", "deleted in Plane") in summary.changes

    def test_a_project_deleted_in_plane_is_not_recreated(self, loader):
        loader.run()
        Project.objects.get(external_source="confluence", external_id="100").delete()

        summary = loader.run()

        assert summary.skipped == "project was deleted in Plane"
        assert not Project.objects.filter(external_source="confluence", external_id="100").exists()

        assert "Hello" in by_external_id("11").description_html


@pytest.mark.unit
@pytest.mark.django_db
class TestPlan:
    def test_first_run_lists_every_creation(self, loader):
        summary = loader.run(dry_run=True)

        assert Change("create", "Folder 99", "placeholder") in summary.changes
        assert sum(1 for change in summary.changes if change.kind == "create") == 6
        assert not Page.objects.filter(external_source="confluence").exists()

    def test_second_run_lists_only_what_changes(self, loader):
        loader.run()
        Page.objects.filter(pk=by_external_id("12").pk).update(parent=None, sort_order=1)

        summary = loader.run(dry_run=True)

        assert summary.changes == [Change("move", "First", "root -> Home")]
        assert summary.reordered == 1
        assert by_external_id("12").parent is None
