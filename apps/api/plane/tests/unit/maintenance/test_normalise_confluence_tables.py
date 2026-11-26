# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from collections import Counter
from collections.abc import Callable, Iterator
from contextlib import AbstractContextManager
from unittest import mock

import pytest
from django.utils import timezone

from plane.db.models import Page, PageApproval, PageVersion, Project, ProjectPage, User, Workspace
from plane.maintenance.upgrade import JsonValue
from plane.maintenance.upgrades import UPGRADES
from plane.maintenance.upgrades import normalise_confluence_tables as upgrade
from plane.utils import live_content

TABLE = '<table class="wrapped"><tbody><tr><th colspan="1">Frequency</th><td colspan="1">Year</td></tr></tbody></table>'
CLEAN_TABLE = "<table><tbody><tr><th><p>Field</p></th><th><p>Value</p></th></tr></tbody></table>"

type MakePage = Callable[..., Page]
type CaptureOnCommit = Callable[..., AbstractContextManager[list[Callable[[], object]]]]


@pytest.fixture
def project(workspace: Workspace, create_user: User) -> Project:
    return Project.objects.create(name="ISMS", identifier="ISMS", workspace=workspace, created_by=create_user)


@pytest.fixture
def make_page(workspace: Workspace, project: Project, create_user: User) -> MakePage:
    def make(name: str, html: str = "<p></p>", source: str | None = "confluence", **extra: object) -> Page:
        page = Page.objects.create(
            name=name, workspace=workspace, owned_by=create_user, external_source=source, **extra
        )
        ProjectPage.objects.create(workspace=workspace, project=project, page=page)
        # stored as the import stored it, without the save() hooks
        Page.all_objects.filter(pk=page.pk).update(description_html=html)
        page.refresh_from_db()
        return page

    return make


@pytest.fixture
def publish() -> Iterator[mock.MagicMock]:
    with mock.patch.object(live_content, "_publish") as published:
        yield published


def _run(django_capture_on_commit_callbacks: CaptureOnCommit) -> Counter[str]:
    totals: Counter[str] = Counter()
    cursor: JsonValue = None
    with django_capture_on_commit_callbacks(execute=True):
        while True:
            batch = upgrade.step(cursor)
            totals.update(batch.counts)
            cursor = batch.cursor
            if cursor is None:
                return totals


def _page(page: Page) -> Page:
    return Page.all_objects.get(pk=page.pk)


@pytest.mark.unit
@pytest.mark.django_db
class TestNormaliseConfluenceTables:
    def test_is_registered_first(self) -> None:
        assert UPGRADES[0] is upgrade.UPGRADE

    def test_rewrites_the_table_and_drops_the_derived_document(
        self, make_page: MakePage, publish: mock.MagicMock, django_capture_on_commit_callbacks: CaptureOnCommit
    ) -> None:
        page = make_page("9.1 General", TABLE)
        Page.objects.filter(pk=page.pk).update(description_binary=b"stale", description_json={"type": "doc"})

        totals = _run(django_capture_on_commit_callbacks)

        page = _page(page)
        assert "wrapped" not in page.description_html
        assert 'colspan="1"' not in page.description_html
        assert "<td><p>Year</p></td>" in page.description_html
        assert page.description_binary is None
        assert page.description_json == {}
        assert "Year" in page.description_stripped
        assert (totals["scanned"], totals["rewritten"]) == (1, 1)
        publish.assert_called_once()
        event = publish.call_args.args[0]
        assert (event["page"], event["html"]) == (str(page.id), page.description_html)

    def test_tells_the_live_servers_only_on_commit(
        self, make_page: MakePage, publish: mock.MagicMock, django_capture_on_commit_callbacks: CaptureOnCommit
    ) -> None:
        make_page("9.1 General", TABLE)

        with django_capture_on_commit_callbacks(execute=False) as callbacks:
            upgrade.step(None)

        publish.assert_not_called()
        for callback in callbacks:
            callback()
        publish.assert_called_once()

    def test_records_the_old_and_the_new_body_as_versions(
        self,
        make_page: MakePage,
        create_user: User,
        publish: mock.MagicMock,
        django_capture_on_commit_callbacks: CaptureOnCommit,
    ) -> None:
        page = make_page("9.1 General", TABLE)

        _run(django_capture_on_commit_callbacks)

        versions = list(PageVersion.objects.filter(page=page).order_by("last_saved_at"))
        assert [version.description_html for version in versions] == [TABLE, _page(page).description_html]
        assert {version.owned_by_id for version in versions} == {create_user.id}

    def test_a_page_without_a_table_is_left_alone(
        self, make_page: MakePage, publish: mock.MagicMock, django_capture_on_commit_callbacks: CaptureOnCommit
    ) -> None:
        page = make_page("Plain", "<p>nothing here</p>")
        Page.objects.filter(pk=page.pk).update(description_binary=b"keep")

        totals = _run(django_capture_on_commit_callbacks)

        assert bytes(_page(page).description_binary) == b"keep"
        assert totals["unchanged"] == 1
        publish.assert_not_called()

    def test_a_clean_table_with_a_stored_document_is_rebuilt(
        self, make_page: MakePage, publish: mock.MagicMock, django_capture_on_commit_callbacks: CaptureOnCommit
    ) -> None:
        page = make_page("Agent", CLEAN_TABLE)
        Page.objects.filter(pk=page.pk).update(description_binary=b"old widths")

        totals = _run(django_capture_on_commit_callbacks)

        page = _page(page)
        assert page.description_binary is None
        assert page.description_html == CLEAN_TABLE
        assert not PageVersion.objects.filter(page=page).exists()
        assert totals["rebuilt"] == 1
        assert publish.call_args.args[0]["html"] == CLEAN_TABLE

    def test_a_clean_table_without_a_stored_document_is_unchanged(
        self, make_page: MakePage, publish: mock.MagicMock, django_capture_on_commit_callbacks: CaptureOnCommit
    ) -> None:
        make_page("Agent", CLEAN_TABLE)

        assert _run(django_capture_on_commit_callbacks)["unchanged"] == 1
        publish.assert_not_called()

    def test_a_page_edited_meanwhile_is_skipped(
        self, make_page: MakePage, publish: mock.MagicMock, django_capture_on_commit_callbacks: CaptureOnCommit
    ) -> None:
        page = make_page("9.1 General", TABLE)
        edited = TABLE + "<p>new</p>"

        def edit_first(page_: Page, has_binary: bool, in_force_html: str | None) -> str:
            Page.objects.filter(pk=page_.pk).update(description_html=edited)
            return original(page_, has_binary, in_force_html)

        original = upgrade._upgrade_page
        with mock.patch.object(upgrade, "_upgrade_page", edit_first):
            totals = _run(django_capture_on_commit_callbacks)

        assert totals["raced"] == 1
        assert _page(page).description_html == edited
        assert not PageVersion.objects.filter(page=page).exists()
        publish.assert_not_called()

    def test_locked_archived_and_deleted_pages_are_included(
        self, make_page: MakePage, publish: mock.MagicMock, django_capture_on_commit_callbacks: CaptureOnCommit
    ) -> None:
        pages = [
            make_page("Locked", TABLE, is_locked=True),
            make_page("Archived", TABLE, archived_at=timezone.now().date()),
            make_page("Deleted", TABLE, deleted_at=timezone.now()),
        ]

        totals = _run(django_capture_on_commit_callbacks)

        assert totals["rewritten"] == 3
        assert all("wrapped" not in _page(page).description_html for page in pages)

    def test_pages_not_imported_from_confluence_are_ignored(
        self, make_page: MakePage, publish: mock.MagicMock, django_capture_on_commit_callbacks: CaptureOnCommit
    ) -> None:
        page = make_page("Native", TABLE, source=None)

        totals = _run(django_capture_on_commit_callbacks)

        assert _page(page).description_html == TABLE
        assert totals["scanned"] == 0

    def test_a_page_failing_validation_is_counted_and_the_rest_go_on(
        self, make_page: MakePage, publish: mock.MagicMock, django_capture_on_commit_callbacks: CaptureOnCommit
    ) -> None:
        broken = make_page("Broken", TABLE + "<p>broken</p>")
        fine = make_page("Fine", TABLE)
        validate = upgrade.validate_html_content

        def failing(html: str) -> tuple[bool, str | None, str | None]:
            return (False, "too big", None) if "broken" in html else validate(html)

        with mock.patch.object(upgrade, "validate_html_content", failing):
            totals = _run(django_capture_on_commit_callbacks)

        assert (totals["failed"], totals["rewritten"]) == (1, 1)
        assert _page(broken).description_html == TABLE + "<p>broken</p>"
        assert "wrapped" not in _page(fine).description_html

    def test_batches_leave_the_document_columns_unloaded(
        self, make_page: MakePage, publish: mock.MagicMock, django_capture_on_commit_callbacks: CaptureOnCommit
    ) -> None:
        make_page("9.1 General", TABLE)

        pages, _ = upgrade.keyset_batch(upgrade._pages(), None, upgrade.BATCH_SIZE)

        assert {"description_json", "description_binary"} <= pages[0].get_deferred_fields()

    def test_walks_every_page_in_small_batches(
        self,
        make_page: MakePage,
        publish: mock.MagicMock,
        django_capture_on_commit_callbacks: CaptureOnCommit,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(upgrade, "BATCH_SIZE", 2)
        for index in range(5):
            make_page(f"Page {index}", TABLE)

        totals = _run(django_capture_on_commit_callbacks)

        assert (totals["scanned"], totals["rewritten"]) == (5, 5)

    def test_a_second_run_changes_nothing(
        self, make_page: MakePage, publish: mock.MagicMock, django_capture_on_commit_callbacks: CaptureOnCommit
    ) -> None:
        page = make_page("9.1 General", TABLE)
        rebuilt = make_page("Agent", CLEAN_TABLE)
        Page.objects.filter(pk=rebuilt.pk).update(description_binary=b"old widths")
        _run(django_capture_on_commit_callbacks)
        first = _page(page).description_html
        publish.reset_mock()

        totals = _run(django_capture_on_commit_callbacks)

        assert _page(page).description_html == first
        assert (totals["scanned"], totals["unchanged"]) == (2, 2)
        publish.assert_not_called()


@pytest.mark.unit
@pytest.mark.django_db
class TestPagesWithAVersionInForce:
    @staticmethod
    def _put_in_force(page: Page, project: Project, html: str, *, approved: bool = False) -> PageVersion:
        version = PageVersion.objects.create(
            workspace_id=page.workspace_id, page_id=page.id, owned_by_id=page.owned_by_id, description_html=html
        )
        field = "approved_version" if approved else "baseline_version"
        PageApproval.objects.create(
            page=page,
            project=project,
            workspace_id=page.workspace_id,
            status=PageApproval.APPROVED if approved else PageApproval.BASELINE,
            **{field: version},
        )
        return version

    @pytest.mark.parametrize("approved", [True, False])
    def test_a_page_matching_its_version_in_force_is_skipped(
        self,
        approved: bool,
        make_page: MakePage,
        project: Project,
        publish: mock.MagicMock,
        django_capture_on_commit_callbacks: CaptureOnCommit,
    ) -> None:
        page = make_page("9.1 General", TABLE)
        version = self._put_in_force(page, project, TABLE, approved=approved)

        totals = _run(django_capture_on_commit_callbacks)

        assert totals["in_force"] == 1
        assert _page(page).description_html == TABLE
        assert PageVersion.objects.get(pk=version.pk).description_html == TABLE
        assert PageVersion.objects.filter(page=page).count() == 1
        publish.assert_not_called()

    def test_a_rebuild_that_would_show_unapproved_changes_is_skipped(
        self,
        make_page: MakePage,
        project: Project,
        publish: mock.MagicMock,
        django_capture_on_commit_callbacks: CaptureOnCommit,
    ) -> None:
        page = make_page("Agent", CLEAN_TABLE)
        Page.objects.filter(pk=page.pk).update(description_binary=b"old widths")
        self._put_in_force(page, project, CLEAN_TABLE)

        totals = _run(django_capture_on_commit_callbacks)

        assert totals["in_force"] == 1
        assert bytes(_page(page).description_binary) == b"old widths"

    def test_a_page_with_unapproved_changes_is_rewritten_and_the_version_in_force_kept(
        self,
        make_page: MakePage,
        project: Project,
        publish: mock.MagicMock,
        django_capture_on_commit_callbacks: CaptureOnCommit,
    ) -> None:
        draft = TABLE + "<p>draft</p>"
        page = make_page("9.1 General", draft)
        version = self._put_in_force(page, project, TABLE)

        totals = _run(django_capture_on_commit_callbacks)

        assert totals["rewritten"] == 1
        assert "wrapped" not in _page(page).description_html
        assert PageVersion.objects.get(pk=version.pk).description_html == TABLE
