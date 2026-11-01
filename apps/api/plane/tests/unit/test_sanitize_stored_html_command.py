# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from io import StringIO
from unittest import mock

import pytest
from django.core.management import CommandError, call_command
from django.utils import timezone

from plane.db.models import (
    Description,
    DraftIssue,
    Intake,
    IntakeIssue,
    Issue,
    IssueComment,
    IssueDescriptionVersion,
    Page,
    Project,
    State,
)
from plane.utils.content_validator import MAX_SIZE
from plane.utils.issue_type import link_starter_type

UNSAFE = '<p onclick="steal()">hi</p><script>alert(1)</script>'
SAFE = "<p>hi</p>"


def _store(model, row, **values):
    model.all_objects.filter(pk=row.pk).update(**values)
    return model.all_objects.get(pk=row.pk)


def _page(workspace, user, html, **extra):
    page = Page.objects.create(name="Notes", workspace=workspace, owned_by=user, **extra)
    return _store(Page, page, description_html=html)


def _run(*args):
    out, err = StringIO(), StringIO()
    call_command("sanitize_stored_html", *args, stdout=out, stderr=err)
    return out.getvalue(), err.getvalue()


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="Test Project", identifier="TP", workspace=workspace, created_by=create_user)
    State.objects.create(name="Todo", project=project, group="backlog", default=True)
    return project


@pytest.fixture
def issue(workspace, project, create_user):
    issue = Issue.objects.create(name="Bug", workspace=workspace, project=project, type=link_starter_type(project))
    return _store(Issue, issue, description_html=UNSAFE)


@pytest.mark.unit
@pytest.mark.django_db
class TestSanitizeStoredHtml:
    def test_dry_run_is_the_default_and_writes_nothing(self, workspace, create_user):
        page = _page(workspace, create_user, UNSAFE)

        out, _ = _run()

        assert f"would change page {page.id}" in out
        assert "done: scanned 1, would change 1" in out
        assert "steal" not in out
        assert Page.all_objects.get(pk=page.pk).description_html == UNSAFE

    def test_apply_sanitizes_an_unsafe_page(self, workspace, create_user):
        page = _page(workspace, create_user, UNSAFE)

        _run("--apply")

        stored = Page.all_objects.get(pk=page.pk)
        assert stored.description_html == SAFE
        assert stored.description_stripped == "hi"
        assert stored.updated_at == page.updated_at

    def test_apply_leaves_a_safe_page_alone(self, workspace, create_user):
        page = _page(workspace, create_user, SAFE)

        with mock.patch.object(Page.all_objects, "bulk_update") as bulk_update:
            out, _ = _run("--apply")

        bulk_update.assert_not_called()
        assert "changed 0" in out
        assert Page.all_objects.get(pk=page.pk).updated_at == page.updated_at

    def test_covers_deleted_and_archived_pages(self, workspace, create_user):
        deleted = _page(workspace, create_user, UNSAFE, deleted_at=timezone.now())
        archived = _page(workspace, create_user, UNSAFE, archived_at=timezone.now().date())

        _run("--apply")

        assert Page.all_objects.get(pk=deleted.pk).description_html == SAFE
        assert Page.all_objects.get(pk=archived.pk).description_html == SAFE

    def test_a_rejected_row_is_counted_and_skipped(self, workspace, create_user):
        oversized = "<p>" + "a" * MAX_SIZE + "</p>"
        rejected = _page(workspace, create_user, oversized)
        unsafe = _page(workspace, create_user, UNSAFE)

        out, err = _run("--apply")

        assert f"rejected page {rejected.id}" in err
        assert "done: scanned 2, changed 1, failed 1" in out
        assert Page.all_objects.get(pk=rejected.pk).description_html == oversized
        assert Page.all_objects.get(pk=unsafe.pk).description_html == SAFE

    def test_batches(self, workspace, create_user):
        pages = [_page(workspace, create_user, UNSAFE if i % 2 == 0 else SAFE) for i in range(5)]

        with mock.patch.object(Page.all_objects, "bulk_update", wraps=Page.all_objects.bulk_update) as bulk_update:
            out, _ = _run("--apply", "--batch-size", "2")

        assert [len(call.args[0]) for call in bulk_update.call_args_list] == [2, 1]
        assert "page: scanned 2," in out
        assert "page: scanned 4," in out
        assert "page: scanned 5, changed 3, failed 0" in out
        for page in pages:
            assert Page.all_objects.get(pk=page.pk).description_html == SAFE

    def test_model_limits_the_run(self, workspace, create_user, issue):
        page = _page(workspace, create_user, UNSAFE)

        out, _ = _run("--apply", "--model", "issue")

        assert "page:" not in out
        assert Page.all_objects.get(pk=page.pk).description_html == UNSAFE
        assert Issue.all_objects.get(pk=issue.pk).description_html == SAFE

    def test_issue(self, issue):
        _run("--apply", "--model", "issue")

        stored = Issue.all_objects.get(pk=issue.pk)
        assert stored.description_html == SAFE
        assert stored.description_stripped == "hi"
        assert stored.updated_at == issue.updated_at

    def test_intake_issue(self, workspace, project, issue):
        intake = Intake.objects.create(name="Intake", project=project)
        IntakeIssue.objects.create(intake=intake, issue=issue, project=project)

        out, _ = _run("--apply", "--model", "issue")

        assert f"changed issue {issue.id}" in out
        assert Issue.all_objects.get(pk=issue.pk).description_html == SAFE

    def test_issue_description_version(self, workspace, project, issue, create_user):
        version = IssueDescriptionVersion.objects.create(
            workspace=workspace, project=project, issue=issue, owned_by=create_user, description_html=UNSAFE
        )

        _run("--apply", "--model", "issue_description_version")

        stored = IssueDescriptionVersion.all_objects.get(pk=version.pk)
        assert stored.description_html == SAFE
        assert stored.description_stripped == "hi"
        assert stored.updated_at == version.updated_at

    def test_issue_comment_and_its_description(self, workspace, project, issue, create_user):
        comment = IssueComment.objects.create(
            workspace=workspace, project=project, issue=issue, actor=create_user, comment_html=SAFE
        )
        comment = _store(IssueComment, comment, comment_html=UNSAFE)
        Description.objects.filter(pk=comment.description_id).update(description_html=UNSAFE)

        _run("--apply", "--model", "issue_comment")

        stored = IssueComment.all_objects.get(pk=comment.pk)
        assert stored.comment_html == SAFE
        assert stored.comment_stripped == "hi"
        assert stored.updated_at == comment.updated_at
        description = Description.all_objects.get(pk=comment.description_id)
        assert description.description_html == SAFE
        assert description.description_stripped == "hi"

    def test_draft_issue(self, workspace, project):
        draft = DraftIssue.objects.create(name="Draft", workspace=workspace, project=project)
        draft = _store(DraftIssue, draft, description_html=UNSAFE)

        _run("--apply", "--model", "draft_issue")

        stored = DraftIssue.all_objects.get(pk=draft.pk)
        assert stored.description_html == SAFE
        assert stored.description_stripped == "hi"
        assert stored.updated_at == draft.updated_at

    def test_html_that_sanitizes_to_nothing(self, workspace, project, issue, create_user):
        comment = IssueComment.objects.create(
            workspace=workspace, project=project, issue=issue, actor=create_user, comment_html=SAFE
        )
        comment = _store(IssueComment, comment, comment_html="<script>alert(1)</script>")

        _run("--apply", "--model", "issue_comment")

        stored = IssueComment.all_objects.get(pk=comment.pk)
        assert stored.comment_html == ""
        assert stored.comment_stripped == ""

    def test_rejects_a_batch_size_below_one(self):
        with pytest.raises(CommandError, match="batch-size"):
            _run("--batch-size", "0")
