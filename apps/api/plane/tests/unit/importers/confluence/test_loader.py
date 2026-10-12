# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone

from plane.db.models import Page, PageVersion, Project, ProjectMember, User, WorkspaceMember
from plane.importers.confluence.backup import SORT_STEP, ConfluenceBackup
from plane.importers.confluence.loader import (
    CONTAINER_HTML,
    CONTAINER_LOGOS,
    PLACEHOLDER_HTML,
    Change,
    ConfluenceLoader,
)
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


def folder_record(folder_id, title, parent=None, parent_type="page", position=0, kind="folder"):
    """A folders.jsonl line: a v2 folder object, createdAt in epoch milliseconds."""
    return {
        "id": folder_id,
        "type": kind,
        "title": title,
        "parentId": parent,
        "parentType": parent_type if parent else None,
        "position": position,
        "status": "current",
        "authorId": "acc-owner",
        "createdAt": 1704103200000,
        "version": {"number": 1, "createdAt": "2024-01-01T10:00:00Z"},
    }


# folder 99 sits in folder 98, which sits under the Home page
FOLDERS = [
    folder_record("98", "Operations", parent="10", position=5),
    folder_record("99", "Onboarding", parent="98", parent_type="folder"),
]


def write_folders(root, folders=FOLDERS, space=SPACE):
    (root / "confluence" / space["key"] / "folders.jsonl").write_text(
        "\n".join(json.dumps(folder) for folder in folders) + "\n"
    )


@pytest.mark.unit
@pytest.mark.django_db
class TestFolders:
    def test_folders_become_pages_with_their_place_in_the_tree(self, loader, tmp_path):
        write_folders(tmp_path)

        summary = loader.run()

        operations, onboarding = by_external_id("folder-98"), by_external_id("folder-99")
        assert (operations.name, operations.parent_id) == ("Operations", by_external_id("10").id)
        assert (onboarding.name, onboarding.parent_id) == ("Onboarding", operations.id)
        assert by_external_id("13").parent_id == onboarding.id
        assert onboarding.description_html == CONTAINER_HTML
        assert onboarding.logo_props == CONTAINER_LOGOS["folder"]
        assert onboarding.created_at.year == 2024
        assert (summary.folders, summary.containers) == (2, 0)

    def test_a_structure_run_turns_an_earlier_placeholder_into_the_folder(self, loader, tmp_path):
        loader.run()
        placeholder = by_external_id("folder-99")
        assert placeholder.description_html == PLACEHOLDER_HTML
        write_folders(tmp_path)

        summary = loader.run(structure_only=True)

        folder = by_external_id("folder-99")
        assert folder.pk == placeholder.pk
        assert (folder.name, folder.parent_id) == ("Onboarding", by_external_id("folder-98").id)
        assert folder.description_html == CONTAINER_HTML
        assert folder.logo_props == CONTAINER_LOGOS["folder"]
        assert not PageVersion.objects.filter(page_id=folder.pk, description_html=PLACEHOLDER_HTML).exists()
        assert by_external_id("13").parent_id == folder.pk
        assert summary.placeholders_replaced == 1

    def test_a_placeholder_renamed_by_hand_keeps_its_name(self, loader, tmp_path):
        loader.run()
        Page.objects.filter(external_id="folder-99").update(name="Onboarding (renamed)", updated_at=timezone.now())
        write_folders(tmp_path)

        loader.run(structure_only=True)

        folder = by_external_id("folder-99")
        assert folder.name == "Onboarding (renamed)"
        assert folder.parent_id == by_external_id("folder-98").id
        assert folder.description_html == CONTAINER_HTML

    def test_an_icon_picked_in_plane_is_kept(self, loader, tmp_path):
        write_folders(tmp_path)
        loader.run()
        rocket = {"in_use": "emoji", "emoji": {"value": "128640"}}
        Page.objects.filter(external_id="folder-98").update(logo_props=rocket)

        loader.run(structure_only=True)

        assert by_external_id("folder-98").logo_props == rocket


# The placeholder as the editor saves it back, with its own markup.
OPENED_PLACEHOLDER_HTML = (
    '<p class="editor-paragraph-block" data-id="a1">This page stands in for a Confluence folder or database '
    "the export did not include. Rename it and move it where it belongs.</p>"
)
OPENED_PLACEHOLDER_BINARY = (
    b"\x01\x02\x8b\x01paragraph\x04This page stands in for a Confluence folder or database the export did not include."
)


def open_page(external_id):
    Page.objects.filter(external_id=external_id).update(
        description_html=OPENED_PLACEHOLDER_HTML,
        description_binary=OPENED_PLACEHOLDER_BINARY,
        updated_at=timezone.now(),
    )


def add_version(page, html, binary=None):
    return PageVersion.objects.create(
        workspace=page.workspace,
        page_id=page.pk,
        owned_by_id=page.owned_by_id,
        description_html=html,
        description_binary=binary,
    )


def as_bytes(binary):
    return None if binary is None else bytes(binary)


def snapshot():
    """Every field a folders-only run could touch by accident."""
    pages = {
        page.external_id: (
            page.name,
            page.parent_id,
            page.sort_order,
            page.description_html,
            as_bytes(page.description_binary),
            page.updated_at,
            page.logo_props,
        )
        for page in Page.objects.filter(external_source="confluence")
    }
    versions = {
        version.pk: (version.description_html, as_bytes(version.description_binary))
        for version in PageVersion.objects.all()
    }
    return pages, versions


@pytest.mark.unit
@pytest.mark.django_db
class TestPlaceholderText:
    def test_an_opened_placeholder_is_replaced_and_its_binary_dropped(self, loader, tmp_path):
        loader.run()
        open_page("folder-99")
        write_folders(tmp_path)

        summary = loader.run(structure_only=True)

        folder = by_external_id("folder-99")
        assert (folder.name, folder.description_html) == ("Onboarding", CONTAINER_HTML)
        assert folder.description_binary is None
        assert summary.placeholders_replaced == 1

    def test_versions_with_other_placeholder_markup_are_cleaned(self, loader, tmp_path):
        loader.run()
        page = by_external_id("folder-99")
        opened = add_version(page, OPENED_PLACEHOLDER_HTML, OPENED_PLACEHOLDER_BINARY)
        notes = add_version(page, "<p>notes</p>", b"notes")
        write_folders(tmp_path)

        loader.run(structure_only=True)

        assert not any("stands in" in version.description_html for version in PageVersion.objects.filter(page=page))
        opened.refresh_from_db()
        assert (opened.description_html, opened.description_binary) == (CONTAINER_HTML, None)
        notes.refresh_from_db()
        assert (notes.description_html, bytes(notes.description_binary)) == ("<p>notes</p>", b"notes")

    def test_a_seeded_version_carries_no_stale_binary(self, loader, tmp_path):
        loader.run()
        page = by_external_id("folder-99")
        PageVersion.objects.filter(page=page).delete()
        open_page("folder-99")
        write_folders(tmp_path)

        loader.run(structure_only=True)

        version = PageVersion.objects.get(page=page)
        assert (version.description_html, version.description_binary) == (CONTAINER_HTML, None)


@pytest.mark.unit
@pytest.mark.django_db
class TestFoldersOnly:
    def test_a_repair_run_cleans_versions_and_binary_and_nothing_else(self, loader, tmp_path):
        """An earlier conversion emptied the body but left the placeholder in
        the binary and in a version."""
        write_folders(tmp_path)
        loader.run()
        folder = by_external_id("folder-99")
        Page.objects.filter(pk=folder.pk).update(description_binary=OPENED_PLACEHOLDER_BINARY)
        version = add_version(folder, OPENED_PLACEHOLDER_HTML)
        before_pages, before_versions = snapshot()

        summary = loader.run(folders_only=True)

        repaired = snapshot()
        expected = list(before_pages["folder-99"])
        expected[4] = None
        assert repaired[0] == {**before_pages, "folder-99": tuple(expected)}
        assert repaired[1] == {**before_versions, version.pk: (CONTAINER_HTML, None)}
        assert (summary.folders_repaired, summary.placeholders_replaced, summary.folders_created) == (1, 0, 0)
        assert summary.reparented == 0

        again = loader.run(folders_only=True)

        assert again.folders_repaired == 0
        assert snapshot() == repaired

    def test_a_moved_page_stays_while_a_page_in_a_placeholder_follows_the_backup(self, loader, tmp_path):
        loader.run()
        home = by_external_id("10")
        Page.objects.filter(external_id="12").update(parent=None, sort_order=1)
        # page 13 moved from folder 99 to folder 98 in Confluence since the first backup
        moved = record("13", "In folder", parent="98", parent_type="folder")
        write_backup(tmp_path, pages=[page for page in PAGES if page["id"] != "13"] + [moved])
        write_folders(tmp_path)

        summary = loader.run(folders_only=True)

        operations, onboarding = by_external_id("folder-98"), by_external_id("folder-99")
        assert operations.parent_id == home.id
        assert (onboarding.name, onboarding.parent_id) == ("Onboarding", operations.id)
        assert by_external_id("13").parent_id == operations.id
        manual = by_external_id("12")
        assert (manual.parent_id, manual.sort_order) == (None, 1)
        assert (summary.folders_created, summary.placeholders_replaced, summary.reparented) == (1, 1, 1)

    def test_a_placeholder_moved_by_hand_keeps_its_place(self, loader, tmp_path):
        loader.run()
        home = by_external_id("10")
        Page.objects.filter(external_id="folder-99").update(parent=home, sort_order=7)
        write_folders(tmp_path)

        loader.run(folders_only=True)

        folder = by_external_id("folder-99")
        assert (folder.parent_id, folder.sort_order) == (home.id, 7)
        assert folder.description_html == CONTAINER_HTML

    def test_a_placeholder_written_in_is_kept_and_its_versions_left_alone(self, loader, tmp_path):
        loader.run()
        written = PLACEHOLDER_HTML + "<p>my notes</p>"
        Page.objects.filter(external_id="folder-99").update(description_html=written)
        page = by_external_id("folder-99")
        versions = set(PageVersion.objects.filter(page=page).values_list("pk", "description_html"))
        write_folders(tmp_path)

        summary = loader.run(folders_only=True)

        assert by_external_id("folder-99").description_html == written
        assert set(PageVersion.objects.filter(page=page).values_list("pk", "description_html")) == versions
        assert (summary.kept, summary.folders_repaired, summary.placeholders_replaced) == (1, 0, 0)
        assert [(c.kind, c.detail) for c in summary.changes if c.kind == "keep"] == [
            ("keep", "placeholder text plus edits")
        ]

    def test_plan_makes_no_writes(self, loader, workspace, create_user, tmp_path):
        loader.run()
        open_page("folder-99")
        Page.objects.filter(external_id="12").update(parent=None, sort_order=1)
        write_folders(tmp_path)
        before = snapshot()
        out = StringIO()

        call_command(
            "import_confluence",
            "--space=DEMO",
            f"--backup-dir={tmp_path}",
            f"--workspace={workspace.slug}",
            f"--actor={create_user.email}",
            "--folders-only",
            "--plan",
            stdout=out,
        )

        assert snapshot() == before
        report = out.getvalue()
        assert "folders     2 folders and databases: 1 created, 1 placeholders replaced, 0 repaired" in report
        assert "reparented  0 pages moved out of placeholders" in report
        assert "pages       " not in report
        assert "  replace Onboarding: placeholder -> folder" in report
