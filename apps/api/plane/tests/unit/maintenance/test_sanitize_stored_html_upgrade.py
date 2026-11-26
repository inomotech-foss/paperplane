# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import gc
import tracemalloc
from collections import Counter
from unittest import mock

import pytest
from django.db.models import Model
from django.utils import timezone

from plane.automation.registry import ActionType
from plane.db.models import (
    Automation,
    AutomationAction,
    Description,
    DescriptionVersion,
    DraftIssue,
    Issue,
    IssueComment,
    IssueDescriptionVersion,
    Page,
    PageVersion,
    Project,
    State,
    User,
    Workspace,
)
from plane.maintenance.upgrade import JsonValue
from plane.maintenance.upgrades import sanitize_stored_html
from plane.maintenance.upgrades.sanitize_stored_html import step
from plane.utils.content_validator import MAX_SIZE
from plane.utils.issue_type import link_starter_type
from plane.utils.stored_html import AutomationTemplate, HtmlField

pytestmark = [pytest.mark.unit, pytest.mark.django_db]

UNSAFE = '<p onclick="steal()">hi</p><script>alert(1)</script>'
SAFE = "<p>hi</p>"


def _store[M: Model](model: type[M], row: M, **values: object) -> M:
    model.all_objects.filter(pk=row.pk).update(**values)
    return model.all_objects.get(pk=row.pk)


def _page(workspace: Workspace, user: User, html: str, **extra: object) -> Page:
    page = Page.objects.create(name="Notes", workspace=workspace, owned_by=user, **extra)
    return _store(Page, page, description_html=html)


def _run() -> Counter[str]:
    totals: Counter[str] = Counter()
    cursor: JsonValue = None
    while True:
        batch = step(cursor)
        totals.update(batch.counts)
        cursor = batch.cursor
        if cursor is None:
            return totals


@pytest.fixture
def project(workspace: Workspace) -> Project:
    project = Project.objects.create(name="Test Project", identifier="TP", workspace=workspace)
    State.objects.create(name="Todo", project=project, group="backlog", default=True)
    return project


@pytest.fixture
def issue(workspace: Workspace, project: Project) -> Issue:
    issue = Issue.objects.create(name="Bug", workspace=workspace, project=project, type=link_starter_type(project))
    return _store(Issue, issue, description_html=UNSAFE)


@pytest.fixture
def comment(workspace: Workspace, project: Project, issue: Issue, create_user: User) -> IssueComment:
    comment = IssueComment.objects.create(
        workspace=workspace, project=project, issue=issue, actor=create_user, comment_html=SAFE
    )
    return _store(IssueComment, comment, comment_html=UNSAFE)


def test_sanitizes_a_page_without_touching_updated_at(workspace, create_user):
    page = _page(workspace, create_user, UNSAFE)

    counts = _run()

    stored = Page.all_objects.get(pk=page.pk)
    assert stored.description_html == SAFE
    assert stored.description_stripped == "hi"
    assert stored.updated_at == page.updated_at
    assert counts["changed"] == 1


def test_leaves_a_safe_page_alone(workspace, create_user):
    _page(workspace, create_user, SAFE)

    with mock.patch.object(HtmlField, "write") as write:
        counts = _run()

    write.assert_not_called()
    assert counts["changed"] == 0


def test_covers_deleted_and_archived_pages(workspace, create_user):
    deleted = _page(workspace, create_user, UNSAFE, deleted_at=timezone.now())
    archived = _page(workspace, create_user, UNSAFE, archived_at=timezone.now().date())

    _run()

    assert Page.all_objects.get(pk=deleted.pk).description_html == SAFE
    assert Page.all_objects.get(pk=archived.pk).description_html == SAFE


def test_a_rejected_row_is_counted_and_left_alone(workspace, create_user):
    oversized = "<p>" + "a" * MAX_SIZE + "</p>"
    rejected = _page(workspace, create_user, oversized)
    unsafe = _page(workspace, create_user, UNSAFE)

    counts = _run()

    assert (counts["changed"], counts["failed"]) == (1, 1)
    assert Page.all_objects.get(pk=rejected.pk).description_html == oversized
    assert Page.all_objects.get(pk=unsafe.pk).description_html == SAFE


def test_work_item_versions_and_drafts(workspace, project, issue, create_user):
    issue_version = IssueDescriptionVersion.objects.create(
        workspace=workspace, project=project, issue=issue, owned_by=create_user, description_html=UNSAFE
    )
    draft = _store(
        DraftIssue,
        DraftIssue.objects.create(name="Draft", workspace=workspace, project=project),
        description_html=UNSAFE,
    )
    page = _page(workspace, create_user, SAFE)
    page_version = _store(
        PageVersion,
        PageVersion.objects.create(workspace=workspace, page=page, owned_by=create_user, description_html=SAFE),
        description_html=UNSAFE,
    )

    _run()

    for model, row in [
        (Issue, issue),
        (IssueDescriptionVersion, issue_version),
        (DraftIssue, draft),
        (PageVersion, page_version),
    ]:
        stored = model.all_objects.get(pk=row.pk)
        assert (stored.description_html, stored.description_stripped) == (SAFE, "hi")
        assert stored.updated_at == row.updated_at


def test_a_comment_and_its_description(workspace, comment):
    Description.objects.filter(pk=comment.description_id).update(description_html=UNSAFE)
    version = DescriptionVersion.objects.create(
        workspace=workspace, description_id=comment.description_id, description_html=UNSAFE
    )

    _run()

    stored = IssueComment.all_objects.get(pk=comment.pk)
    assert (stored.comment_html, stored.comment_stripped) == (SAFE, "hi")
    assert stored.updated_at == comment.updated_at
    description = Description.all_objects.get(pk=comment.description_id)
    assert (description.description_html, description.description_stripped) == (SAFE, "hi")
    assert DescriptionVersion.all_objects.get(pk=version.pk).description_html == SAFE


def test_html_that_sanitizes_to_nothing(comment):
    _store(IssueComment, comment, comment_html="<script>alert(1)</script>")

    _run()

    stored = IssueComment.all_objects.get(pk=comment.pk)
    assert (stored.comment_html, stored.comment_stripped) == ("", "")
    description = Description.all_objects.get(pk=comment.description_id)
    assert (description.description_html, description.description_stripped) == ("", "")


def test_automation_templates(workspace, project, create_user):
    automation = Automation.objects.create(workspace=workspace, project=project, name="Rule", owned_by=create_user)

    def action(action_type: str, config: dict[str, str]) -> AutomationAction:
        return AutomationAction.objects.create(
            automation=automation, workspace=workspace, action_type=action_type, config=config
        )

    comment = action(ActionType.ADD_COMMENT, {"comment_html": "<p>{{work_item.name}}</p><script>x</script>"})
    create = action(ActionType.CREATE_WORK_ITEM, {"name": "Follow up", "description_html": UNSAFE})
    safe = action(ActionType.ADD_COMMENT, {"comment_html": "<p>{{work_item.name}}</p>"})
    webhook = action(ActionType.CALL_WEBHOOK, {"url": "https://example.com", "body": UNSAFE})

    counts = _run()

    assert counts["changed"] == 2
    stored = AutomationAction.objects.get(pk=comment.pk)
    assert stored.config == {"comment_html": "<p>{{work_item.name}}</p>"}
    assert stored.updated_at == comment.updated_at
    assert AutomationAction.objects.get(pk=create.pk).config == {"name": "Follow up", "description_html": SAFE}
    assert AutomationAction.objects.get(pk=safe.pk).updated_at == safe.updated_at
    assert AutomationAction.objects.get(pk=webhook.pk).config == webhook.config


def test_a_second_run_changes_nothing(workspace, create_user, comment):
    _page(workspace, create_user, UNSAFE)

    first = _run()
    second = _run()

    assert first["changed"] > 0
    assert second["scanned"] == first["scanned"]
    assert (second["changed"], second["skipped"], second["failed"]) == (0, 0, 0)


def test_a_row_edited_during_the_run_is_skipped(workspace, create_user):
    edited = _page(workspace, create_user, UNSAFE)
    untouched = _page(workspace, create_user, UNSAFE)
    original_write = HtmlField.write

    def edit_then_write(target: HtmlField, row: Model, clean: str) -> bool:
        if row.pk == edited.pk:
            Page.all_objects.filter(pk=edited.pk).update(description_html="<p>new edit</p>")
        return original_write(target, row, clean)

    with mock.patch.object(HtmlField, "write", autospec=True, side_effect=edit_then_write):
        counts = _run()

    assert (counts["changed"], counts["skipped"]) == (1, 1)
    assert Page.all_objects.get(pk=edited.pk).description_html == "<p>new edit</p>"
    assert Page.all_objects.get(pk=untouched.pk).description_html == SAFE


def test_an_automation_edited_during_the_run_is_skipped(workspace, project, create_user):
    automation = Automation.objects.create(workspace=workspace, project=project, name="Rule", owned_by=create_user)
    action = AutomationAction.objects.create(
        automation=automation, workspace=workspace, action_type=ActionType.ADD_COMMENT, config={"comment_html": UNSAFE}
    )
    edited = {"comment_html": UNSAFE, "note": "edited meanwhile"}
    original_write = AutomationTemplate.write

    def edit_then_write(target: AutomationTemplate, row: Model, clean: str) -> bool:
        AutomationAction.objects.filter(pk=action.pk).update(config=edited)
        return original_write(target, row, clean)

    with mock.patch.object(AutomationTemplate, "write", autospec=True, side_effect=edit_then_write):
        counts = _run()

    assert counts["skipped"] == 1
    assert AutomationAction.objects.get(pk=action.pk).config == edited


def test_the_cursor_walks_each_model_in_turn(monkeypatch, workspace, create_user, issue):
    monkeypatch.setattr(sanitize_stored_html, "BATCH_SIZE", 1)
    page = _page(workspace, create_user, UNSAFE)

    first = step(None)
    assert first.cursor == {"target": "page", "after": str(page.pk)}
    assert first.counts["changed"] == 1

    second = step(first.cursor)
    assert second.cursor == {"target": "page_version", "after": None}
    assert second.counts["scanned"] == 0

    third = step(second.cursor)
    assert third.cursor == {"target": "issue", "after": None}

    fourth = step(third.cursor)
    assert fourth.cursor == {"target": "issue", "after": str(issue.pk)}
    assert Issue.all_objects.get(pk=issue.pk).description_html == SAFE

    last = step({"target": "automation", "after": None})
    assert last.cursor is None


@pytest.mark.parametrize("cursor", [{"target": "nothing", "after": None}, {"target": "page", "after": 1}, "page"])
def test_rejects_an_unexpected_cursor(cursor):
    with pytest.raises(ValueError, match="Unexpected cursor"):
        step(cursor)


def test_memory_does_not_grow_with_the_number_of_rows(workspace, create_user):
    html = UNSAFE + "".join(f"<p>{i} {'x' * 2000}</p>" for i in range(50))

    def peak_for(rows: int) -> int:
        Page.all_objects.all().delete()
        for _ in range(rows):
            _page(workspace, create_user, html)
        gc.collect()
        tracemalloc.start()
        try:
            _run()
            return tracemalloc.get_traced_memory()[1]
        finally:
            tracemalloc.stop()

    small, large = peak_for(12), peak_for(48)

    assert large < small * 1.25
    assert large < 40 * len(html)
