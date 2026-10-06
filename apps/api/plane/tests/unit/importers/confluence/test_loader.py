# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

import pytest
from django.utils import timezone

from plane.db.models import Page, Project, ProjectMember, User, WorkspaceMember
from plane.importers.confluence.backup import SORT_STEP, ConfluenceBackup
from plane.importers.confluence.loader import PLACEHOLDER_HTML, Change, ConfluenceLoader

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

    def test_full_run_rewrites_an_unedited_body(self, loader):
        loader.run()
        page = by_external_id("11")
        Page.objects.filter(pk=page.pk).update(description_html="<p>changed</p>", updated_at=page.updated_at)

        loader.run()

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
