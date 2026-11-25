# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from io import StringIO
from unittest import mock

import pytest
from django.core.management import CommandError, call_command

from plane.db.models import Page, PageVersion, Project, ProjectPage

COMMAND = "plane.db.management.commands.repair_confluence_pages"

TABLE = '<table class="wrapped"><tbody><tr><th colspan="1">Frequency</th><td colspan="1">Year</td></tr></tbody></table>'


@pytest.fixture
def project(workspace, create_user):
    return Project.objects.create(name="ISMS", identifier="ISMS", workspace=workspace, created_by=create_user)


@pytest.fixture
def make_page(workspace, project, create_user):
    def make(name, html="<p></p>", parent=None, source="confluence", **extra):
        page = Page.objects.create(
            name=name,
            workspace=workspace,
            owned_by=create_user,
            parent=parent,
            external_source=source,
            **extra,
        )
        ProjectPage.objects.create(workspace=workspace, project=project, page=page)
        # stored as the import stored it, without the save() hooks
        Page.objects.filter(pk=page.pk).update(description_html=html)
        page.refresh_from_db()
        return page

    return make


@pytest.fixture
def snippet(make_page):
    parent = make_page("_snippets")
    return make_page("snippet.check.highlevel", "<p>Is the implementation still accurate?</p>", parent=parent)


def _link(project, page):
    return f'<a href="/test-workspace/projects/{project.id}/pages/{page.id}/">{page.name}</a>'


def _run(project, *args):
    out, err = StringIO(), StringIO()
    with mock.patch(f"{COMMAND}.notify_live_content_replaced") as notify:
        call_command("repair_confluence_pages", "--project", str(project.id), *args, stdout=out, stderr=err)
    return out.getvalue(), err.getvalue(), notify


@pytest.mark.unit
@pytest.mark.django_db
class TestRepairConfluencePages:
    def test_dry_run_reports_and_writes_nothing(self, project, make_page):
        page = make_page("9.1 General", TABLE)

        out, _, notify = _run(project, "--dry-run")

        assert f"would rewrite {page.id}" in out
        assert "DRY RUN" in out
        assert Page.objects.get(pk=page.pk).description_html == TABLE
        assert not PageVersion.objects.filter(page=page).exists()
        notify.assert_not_called()

    def test_rewrites_the_table_and_drops_the_derived_document(self, project, make_page):
        page = make_page("9.1 General", TABLE)
        Page.objects.filter(pk=page.pk).update(description_binary=b"stale", description_json={"type": "doc"})

        out, _, notify = _run(project)

        page.refresh_from_db()
        assert "wrapped" not in page.description_html
        assert 'colspan="1"' not in page.description_html
        assert "<td><p>Year</p></td>" in page.description_html
        assert page.description_binary is None
        assert page.description_json == {}
        assert "Year" in page.description_stripped
        notify.assert_called_once_with(page=page.id, description_html=page.description_html)
        assert "did rewrite 1" in out

    def test_records_the_old_and_the_new_body_as_versions(self, project, make_page):
        page = make_page("9.1 General", TABLE)

        _run(project)

        versions = list(PageVersion.objects.filter(page=page).order_by("last_saved_at"))
        assert [version.description_html for version in versions] == [
            TABLE,
            Page.objects.get(pk=page.pk).description_html,
        ]

    def test_turns_snippet_links_into_includes(self, project, make_page, snippet):
        other = make_page("Monitoring plan")
        html = f"<p>{_link(project, snippet)}</p><p>See {_link(project, other)}.</p><p>{_link(project, other)}</p>"
        page = make_page("10.1 General", html)

        out, _, _ = _run(project)

        page.refresh_from_db()
        assert f'<query-block-component kind="include" root-page-id="{snippet.id}">' in page.description_html
        assert page.description_html.count("<a ") == 2
        assert "include snippet.check.highlevel: 1" in out

    def test_no_includes_leaves_snippet_links_alone(self, project, make_page, snippet):
        page = make_page("10.1 General", f"<p>{_link(project, snippet)}</p>")

        _run(project, "--no-includes")

        assert "query-block-component" not in Page.objects.get(pk=page.pk).description_html

    def test_a_page_with_nothing_to_repair_is_left_alone(self, project, make_page):
        page = make_page("Plain", "<p>nothing here</p>")
        Page.objects.filter(pk=page.pk).update(description_binary=b"keep")

        out, _, notify = _run(project)

        page.refresh_from_db()
        assert page.description_binary == b"keep"
        assert "unchanged 1" in out
        notify.assert_not_called()

    def test_a_clean_table_with_a_stored_document_is_rebuilt(self, project, make_page):
        """The stored document fixed every column at 150px; only a rebuild drops that."""
        html = "<table><tbody><tr><th><p>Field</p></th><th><p>Value</p></th></tr></tbody></table>"
        page = make_page("Agent", html)
        Page.objects.filter(pk=page.pk).update(description_binary=b"old widths")

        out, _, notify = _run(project)

        page.refresh_from_db()
        assert page.description_binary is None
        assert page.description_html == html
        assert not PageVersion.objects.filter(page=page).exists()
        assert "only rebuild 1" in out
        notify.assert_called_once()

    def test_pages_not_imported_from_confluence_are_skipped_unless_asked(self, project, make_page):
        page = make_page("Native", TABLE, source=None)

        _run(project)
        assert Page.objects.get(pk=page.pk).description_html == TABLE

        _run(project, "--all-pages")
        assert "wrapped" not in Page.objects.get(pk=page.pk).description_html

    def test_locked_pages_are_skipped_unless_asked(self, project, make_page):
        page = make_page("Locked", TABLE, is_locked=True)

        out, _, _ = _run(project)
        assert f"locked {page.id}" in out
        assert Page.objects.get(pk=page.pk).description_html == TABLE

        _run(project, "--include-locked")
        assert "wrapped" not in Page.objects.get(pk=page.pk).description_html

    def test_the_actor_owns_the_new_version(self, project, make_page, create_user):
        page = make_page("9.1 General", TABLE)

        _run(project, "--actor", create_user.email)

        assert PageVersion.objects.filter(page=page).latest("last_saved_at").owned_by_id == create_user.id

    def test_a_second_run_changes_nothing(self, project, make_page, snippet):
        page = make_page("9.1 General", TABLE + f"<p>{_link(project, snippet)}</p>")
        _run(project)
        first = Page.objects.get(pk=page.pk).description_html

        out, _, notify = _run(project)

        assert Page.objects.get(pk=page.pk).description_html == first
        assert "did rewrite 0" in out
        notify.assert_not_called()

    def test_an_unknown_project_or_actor_is_an_error(self, project):
        with pytest.raises(CommandError):
            call_command("repair_confluence_pages", "--project", "not-a-uuid")
        with pytest.raises(CommandError):
            call_command("repair_confluence_pages", "--project", str(project.id), "--actor", "nobody@example.com")
