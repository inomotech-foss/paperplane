# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import gc
import tracemalloc
from io import StringIO
from unittest import mock

import pytest
from django.core.management import CommandError, call_command
from django.utils import timezone

from plane.automation.registry import ActionType
from plane.db.management.commands import sanitize_stored_html as command
from plane.db.management.commands.sanitize_stored_html import AutomationTemplate, HtmlField
from plane.db.models import (
    Automation,
    AutomationAction,
    Description,
    DescriptionVersion,
    DraftIssue,
    Intake,
    IntakeIssue,
    Issue,
    IssueComment,
    IssueDescriptionVersion,
    Page,
    PageVersion,
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

        with mock.patch.object(HtmlField, "write") as write:
            out, _ = _run("--apply")

        write.assert_not_called()
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
        assert "done: scanned 2, changed 1, skipped (changed during run) 0, failed 1" in out
        assert Page.all_objects.get(pk=rejected.pk).description_html == oversized
        assert Page.all_objects.get(pk=unsafe.pk).description_html == SAFE

    def test_batches_and_writes_each_row_in_its_own_transaction(self, workspace, create_user):
        pages = [_page(workspace, create_user, UNSAFE if i % 2 == 0 else SAFE) for i in range(5)]

        with mock.patch.object(command.transaction, "atomic", wraps=command.transaction.atomic) as atomic:
            out, _ = _run("--apply", "--batch-size", "2", "--model", "page")

        assert atomic.call_count == 3
        assert "page: scanned 5, changed 3, skipped (changed during run) 0, failed 0" in out
        for page in pages:
            assert Page.all_objects.get(pk=page.pk).description_html == SAFE

    def test_max_rows_and_start_after_resume_a_run(self, workspace, create_user):
        pages = sorted((_page(workspace, create_user, UNSAFE) for _ in range(3)), key=lambda page: page.pk)

        out, _ = _run("--apply", "--model", "page", "--batch-size", "1", "--max-rows", "2")

        assert f"resume with --start-after {pages[1].pk}" in out
        assert Page.all_objects.get(pk=pages[2].pk).description_html == UNSAFE

        out, _ = _run("--apply", "--model", "page", "--start-after", str(pages[1].pk))

        assert "page: scanned 1, changed 1" in out
        assert Page.all_objects.get(pk=pages[2].pk).description_html == SAFE

    def test_start_after_needs_a_single_model(self):
        with pytest.raises(CommandError, match="start-after"):
            _run("--start-after", "00000000-0000-0000-0000-000000000000")

    @pytest.mark.parametrize("mode", [(), ("--apply",)])
    def test_memory_does_not_grow_with_the_number_of_rows(self, workspace, create_user, mode):
        html = UNSAFE + "".join(f"<p>{i} {'x' * 2000}</p>" for i in range(100))

        def peak_for(rows):
            Page.all_objects.all().delete()
            for _ in range(rows):
                _page(workspace, create_user, html)
            gc.collect()
            tracemalloc.start()
            try:
                _run(*mode, "--model", "page", "--batch-size", "2")
                return tracemalloc.get_traced_memory()[1]
            finally:
                tracemalloc.stop()

        small, large = peak_for(4), peak_for(16)

        assert large < small * 1.25
        assert large < 40 * len(html)

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
        description = Description.all_objects.get(pk=comment.description_id)
        assert description.description_html == ""
        assert description.description_stripped == ""

    def test_automation_templates(self, workspace, project, create_user):
        automation = Automation.objects.create(workspace=workspace, project=project, name="Rule", owned_by=create_user)

        def action(action_type, config):
            return AutomationAction.objects.create(
                automation=automation, workspace=workspace, action_type=action_type, config=config
            )

        comment = action(ActionType.ADD_COMMENT, {"comment_html": "<p>{{work_item.name}}</p><script>x</script>"})
        create = action(ActionType.CREATE_WORK_ITEM, {"name": "Follow up", "description_html": UNSAFE})
        safe = action(ActionType.ADD_COMMENT, {"comment_html": "<p>{{work_item.name}}</p>"})
        webhook = action(ActionType.CALL_WEBHOOK, {"url": "https://example.com", "body": UNSAFE})

        dry, _ = _run("--model", "automation")
        assert f"would change automation {comment.id}" in dry
        assert AutomationAction.objects.get(pk=comment.pk).config == comment.config

        out, _ = _run("--apply", "--model", "automation")

        assert "automation: scanned 3, changed 2, skipped (changed during run) 0, failed 0" in out
        stored = AutomationAction.objects.get(pk=comment.pk)
        assert stored.config == {"comment_html": "<p>{{work_item.name}}</p>"}
        assert stored.updated_at == comment.updated_at
        assert AutomationAction.objects.get(pk=create.pk).config == {"name": "Follow up", "description_html": SAFE}
        assert AutomationAction.objects.get(pk=safe.pk).updated_at == safe.updated_at
        assert AutomationAction.objects.get(pk=webhook.pk).config == webhook.config

    def test_a_second_run_changes_nothing(self, workspace, project, issue, create_user):
        _page(workspace, create_user, UNSAFE)
        comment = IssueComment.objects.create(
            workspace=workspace, project=project, issue=issue, actor=create_user, comment_html=SAFE
        )
        _store(IssueComment, comment, comment_html=UNSAFE)

        _run("--apply")
        out, _ = _run("--apply")

        assert "done: scanned" in out
        assert ", changed 0, skipped (changed during run) 0, failed 0" in out.splitlines()[-1]

    def test_a_row_edited_during_the_run_is_skipped(self, workspace, create_user):
        edited = _page(workspace, create_user, UNSAFE)
        untouched = _page(workspace, create_user, UNSAFE)
        original_write = HtmlField.write

        def edit_then_write(target, row, clean):
            if row.pk == edited.pk:
                Page.all_objects.filter(pk=edited.pk).update(description_html="<p>new edit</p>")
            return original_write(target, row, clean)

        with mock.patch.object(HtmlField, "write", autospec=True, side_effect=edit_then_write):
            out, _ = _run("--apply", "--model", "page")

        assert f"skipped page {edited.id}: changed during run" in out
        assert "changed 1, skipped (changed during run) 1, failed 0" in out
        assert Page.all_objects.get(pk=edited.pk).description_html == "<p>new edit</p>"
        assert Page.all_objects.get(pk=untouched.pk).description_html == SAFE

    def test_an_automation_edited_during_the_run_is_skipped(self, workspace, project, create_user):
        automation = Automation.objects.create(workspace=workspace, project=project, name="Rule", owned_by=create_user)
        action = AutomationAction.objects.create(
            automation=automation,
            workspace=workspace,
            action_type=ActionType.ADD_COMMENT,
            config={"comment_html": UNSAFE},
        )
        edited = {"comment_html": UNSAFE, "note": "edited meanwhile"}
        original_write = AutomationTemplate.write

        def edit_then_write(target, row, clean):
            AutomationAction.objects.filter(pk=action.pk).update(config=edited)
            return original_write(target, row, clean)

        with mock.patch.object(AutomationTemplate, "write", autospec=True, side_effect=edit_then_write):
            out, _ = _run("--apply", "--model", "automation")

        assert "skipped (changed during run) 1" in out
        assert AutomationAction.objects.get(pk=action.pk).config == edited

    def test_page_version(self, workspace, create_user):
        page = _page(workspace, create_user, SAFE)
        version = PageVersion.objects.create(
            workspace=workspace, page=page, owned_by=create_user, description_html=SAFE
        )
        version = _store(PageVersion, version, description_html=UNSAFE)

        _run("--apply", "--model", "page_version")

        stored = PageVersion.all_objects.get(pk=version.pk)
        assert stored.description_html == SAFE
        assert stored.description_stripped == "hi"
        assert stored.updated_at == version.updated_at

    def test_description_version(self, workspace, project, issue, create_user):
        comment = IssueComment.objects.create(
            workspace=workspace, project=project, issue=issue, actor=create_user, comment_html=SAFE
        )
        version = DescriptionVersion.objects.create(
            workspace=workspace, description_id=comment.description_id, description_html=UNSAFE
        )

        _run("--apply", "--model", "description_version")

        stored = DescriptionVersion.all_objects.get(pk=version.pk)
        assert stored.description_html == SAFE
        assert stored.description_stripped == "hi"

    def test_rejects_a_batch_size_below_one(self):
        with pytest.raises(CommandError, match="batch-size"):
            _run("--batch-size", "0")
