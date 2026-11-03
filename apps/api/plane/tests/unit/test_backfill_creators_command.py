# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from plane.db.models import Issue, IssueActivity, IssueComment, Label, Page, Project, State, User
from plane.utils.issue_type import link_starter_type

pytestmark = pytest.mark.unit


@pytest.fixture
def damage(db, workspace, create_user):
    other = User.objects.create(email="owner@plane.so", username="owner", display_name="owner")
    project = Project.objects.create(name="Damage", identifier="DMG", workspace=workspace)
    state = State.objects.create(name="Todo", project=project, group="backlog", default=True)
    issue_type = link_starter_type(project)
    with_activity = Issue.objects.create(name="Has activity", project=project, state=state, type=issue_type)
    without_activity = Issue.objects.create(name="No activity", project=project, state=state, type=issue_type)
    kept = Issue.objects.create(name="Has creator", project=project, state=state, type=issue_type)
    IssueActivity.objects.create(issue=with_activity, project=project, verb="created", actor=other)
    later = IssueActivity.objects.create(issue=with_activity, project=project, verb="created", actor=create_user)
    IssueActivity.all_objects.filter(pk=later.pk).update(created_at="2099-01-01T00:00:00Z")
    actorless = IssueActivity.objects.create(issue=with_activity, project=project, verb="updated", actor=None)
    comment = IssueComment.objects.create(issue=with_activity, project=project, actor=other, comment_html="<p>x</p>")
    page = Page.objects.create(name="Owned", workspace=workspace, owned_by=other)
    label = Label.objects.create(name="Orphan", project=project)

    Issue.all_objects.filter(pk__in=[with_activity.pk, without_activity.pk]).update(created_by=None)
    Issue.all_objects.filter(pk=kept.pk).update(created_by=create_user)
    IssueComment.all_objects.filter(pk=comment.pk).update(created_by=None)
    Page.all_objects.filter(pk=page.pk).update(created_by=None, deleted_at="2026-01-01T00:00:00Z")
    Label.all_objects.filter(pk=label.pk).update(created_by=None)
    IssueActivity.all_objects.filter(pk=actorless.pk).update(created_by=None)
    return {
        "other": other,
        "user": create_user,
        "with_activity": with_activity,
        "without_activity": without_activity,
        "kept": kept,
        "comment": comment,
        "page": page,
        "label": label,
        "actorless": actorless,
    }


def _creator(model, obj):
    return model._base_manager.values_list("created_by_id", flat=True).get(pk=obj.pk)


def _run(*args):
    out = StringIO()
    call_command("backfill_creators", *args, stdout=out)
    return out.getvalue()


def test_dry_run_counts_without_writing(damage):
    out = _run("--model", "Issue", "--model", "IssueComment", "--model", "Page")

    assert "Issue: would fill 1" in out
    assert "IssueComment: would fill 1" in out
    assert "Page: would fill 1" in out
    assert _creator(Issue, damage["with_activity"]) is None
    assert _creator(Page, damage["page"]) is None


def test_apply_fills_from_the_inferred_source_and_keeps_the_rest(damage):
    page_before = Page._base_manager.values("updated_at", "updated_by_id").get(pk=damage["page"].pk)

    out = _run("--apply", "--batch-size", "1")

    other = damage["other"].pk
    assert "Total: filled" in out
    assert _creator(Issue, damage["with_activity"]) == other
    assert _creator(IssueComment, damage["comment"]) == other
    assert _creator(Page, damage["page"]) == other
    assert _creator(Issue, damage["without_activity"]) is None
    assert _creator(Label, damage["label"]) is None
    assert _creator(Issue, damage["kept"]) == damage["user"].pk
    assert _creator(IssueActivity, damage["actorless"]) is None
    assert Page._base_manager.values("updated_at", "updated_by_id").get(pk=damage["page"].pk) == page_before


def test_a_second_apply_has_nothing_left(damage):
    _run("--apply")

    assert _run("--apply", "--model", "Issue", "--model", "Page").strip().endswith("Total: filled 0")


def test_rejects_models_without_a_source(damage):
    with pytest.raises(CommandError, match="Label"):
        _run("--model", "Label")
