# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from plane.bgtasks.deletion_task import soft_delete_related_objects
from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import (
    Issue,
    IssueActivity,
    IssueAssignee,
    IssueComment,
    IssueLabel,
    IssueType,
    Label,
    Project,
    ProjectMember,
    State,
    User,
    WorkspaceMember,
)
from plane.utils.issue_type import link_starter_type

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture(autouse=True)
def run_tasks_inline(mocker):
    mocker.patch("plane.db.mixins.soft_delete_related_objects.delay", side_effect=soft_delete_related_objects)
    for module in ("plane.app.views.issue.trash", "plane.app.views.issue.base"):
        mocker.patch(f"{module}.issue_activity.delay", side_effect=lambda **kwargs: issue_activity(**kwargs))


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="Nova", identifier="NOVA", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    State.objects.create(name="Todo", group="unstarted", project=project, workspace=workspace, default=True)
    return project


def make_issue(project, name, parent=None):
    return make_issue_in(project, State.objects.get(project=project, default=True), name, parent)


def make_issue_in(project, state, name="Item", parent=None):
    return Issue.objects.create(name=name, project=project, state=state, parent=parent, type=link_starter_type(project))


def member_client(project, role):
    user = User.objects.create(email=f"role{role}@plane.so", username=f"role{role}")
    WorkspaceMember.objects.create(workspace=project.workspace, member=user, role=role)
    ProjectMember.objects.create(project=project, member=user, role=role)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def url(project, suffix=""):
    return f"/api/workspaces/{project.workspace.slug}/projects/{project.id}/trash/issues/{suffix}"


def delete(client, issue):
    response = client.delete(
        f"/api/workspaces/{issue.project.workspace.slug}/projects/{issue.project_id}/issues/{issue.id}/"
    )
    assert response.status_code == status.HTTP_204_NO_CONTENT


def test_trash_lists_deleted_items_but_not_sub_items_deleted_with_them(session_client, project, create_user):
    parent = make_issue(project, "Parent")
    make_issue(project, "Child", parent=parent)
    make_issue(project, "Alive")
    delete(session_client, parent)

    response = session_client.get(url(project))

    assert response.status_code == status.HTTP_200_OK
    results = response.data["results"]
    assert [item["name"] for item in results] == ["Parent"]
    assert results[0]["deleted_by"] == str(create_user.id)
    assert results[0]["project_identifier"] == "NOVA"
    assert results[0]["purge_at"]


def test_restore_brings_back_what_the_delete_removed(session_client, project, create_user):
    label = Label.objects.create(name="bug", project=project, workspace=project.workspace)
    issue = make_issue(project, "Item")
    child = make_issue(project, "Child", parent=issue)
    IssueLabel.objects.create(issue=issue, label=label, project=project, workspace=project.workspace)
    IssueAssignee.objects.create(issue=issue, assignee=create_user, project=project, workspace=project.workspace)
    comment = IssueComment.objects.create(issue=issue, comment_html="<p>hi</p>", project=project, actor=create_user)
    removed_earlier = IssueComment.objects.create(issue=issue, comment_html="<p>old</p>", project=project)
    IssueComment.all_objects.filter(pk=removed_earlier.pk).update(deleted_at=timezone.now())
    delete(session_client, issue)

    response = session_client.post(url(project, f"{issue.id}/restore/"))

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert Issue.objects.filter(pk__in=[issue.id, child.id]).count() == 2
    assert IssueLabel.objects.filter(issue=issue, label=label).exists()
    assert IssueAssignee.objects.filter(issue=issue, assignee=create_user).exists()
    assert IssueComment.objects.filter(pk=comment.pk).exists()
    assert not IssueComment.objects.filter(pk=removed_earlier.pk).exists()
    assert IssueActivity.objects.filter(issue=issue, verb="restored", actor=create_user).exists()


def test_restore_skips_rows_whose_other_side_was_deleted(session_client, project):
    label = Label.objects.create(name="bug", project=project, workspace=project.workspace)
    issue = make_issue(project, "Item")
    IssueLabel.objects.create(issue=issue, label=label, project=project, workspace=project.workspace)
    delete(session_client, issue)
    Label.all_objects.filter(pk=label.pk).update(deleted_at=timezone.now())

    session_client.post(url(project, f"{issue.id}/restore/"))

    assert Issue.objects.filter(pk=issue.pk).exists()
    assert not IssueLabel.objects.filter(issue=issue).exists()


def test_a_sub_item_restored_alone_leaves_its_deleted_parent(session_client, project):
    parent = make_issue(project, "Parent")
    child = make_issue(project, "Child", parent=parent)
    delete(session_client, child)
    delete(session_client, parent)

    session_client.post(url(project, f"{child.id}/restore/"))

    child = Issue.objects.get(pk=child.pk)
    assert child.parent_id is None


def test_members_can_restore_but_not_purge(project):
    client = member_client(project, role=15)
    issue = make_issue(project, "Item")
    Issue.objects.filter(pk=issue.pk).update(deleted_at=timezone.now())

    purge = client.delete(url(project, f"{issue.id}/"))
    restore = client.post(url(project, f"{issue.id}/restore/"))

    assert purge.status_code == status.HTTP_403_FORBIDDEN
    assert restore.status_code == status.HTTP_204_NO_CONTENT


def test_guests_cannot_see_the_trash(project):
    response = member_client(project, role=5).get(url(project))

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_admins_can_purge(session_client, project):
    issue = make_issue(project, "Item")
    child = make_issue(project, "Child", parent=issue)
    delete(session_client, issue)

    response = session_client.delete(url(project, f"{issue.id}/"))

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert not Issue.all_objects.filter(pk__in=[issue.id, child.id]).exists()


def test_purge_ignores_items_that_are_not_deleted(session_client, project):
    issue = make_issue(project, "Item")

    session_client.delete(url(project, f"{issue.id}/"))

    assert Issue.objects.filter(pk=issue.pk).exists()


def test_bulk_delete_cascades_and_restores_like_a_single_delete(session_client, project, create_user):
    issue = make_issue(project, "Item")
    child = make_issue(project, "Child", parent=issue)

    response = session_client.delete(
        f"/api/workspaces/{project.workspace.slug}/projects/{project.id}/bulk-delete-issues/",
        {"issue_ids": [str(issue.id)]},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert not Issue.objects.filter(pk=child.pk).exists()
    assert Issue.all_objects.get(pk=issue.pk).updated_by == create_user
    session_client.post(url(project, f"{issue.id}/restore/"))
    assert Issue.objects.filter(pk__in=[issue.id, child.id]).count() == 2


def test_a_cascade_that_runs_after_a_restore_changes_nothing(session_client, project):
    issue = make_issue(project, "Item")
    child = make_issue(project, "Child", parent=issue)
    Issue.objects.filter(pk=issue.pk).update(deleted_at=timezone.now())
    session_client.post(url(project, f"{issue.id}/restore/"))

    soft_delete_related_objects("db", "issue", issue.pk)

    assert Issue.objects.filter(pk__in=[issue.id, child.id]).count() == 2


def test_purge_keeps_sub_items_that_were_deleted_on_their_own(session_client, project):
    parent = make_issue(project, "Parent")
    child = make_issue(project, "Child", parent=parent)
    delete(session_client, child)
    delete(session_client, parent)

    session_client.delete(url(project, f"{parent.id}/"))

    child = Issue.all_objects.get(pk=child.pk)
    assert child.deleted_at is not None
    assert child.parent_id is None
    assert [item["name"] for item in session_client.get(url(project)).data["results"]] == ["Child"]


def test_restore_refuses_an_item_whose_type_was_deleted(session_client, project):
    issue = make_issue(project, "Item")
    delete(session_client, issue)
    IssueType.all_objects.filter(pk=issue.type_id).update(deleted_at=timezone.now())

    response = session_client.post(url(project, f"{issue.id}/restore/"))

    assert response.status_code == status.HTTP_409_CONFLICT
    assert not Issue.objects.filter(pk=issue.pk).exists()


def test_restore_moves_an_item_off_a_deleted_state(session_client, project):
    State.objects.filter(project=project).update(default=False)
    State.objects.create(name="Triage", group="triage", is_triage=True, project=project, workspace=project.workspace)
    fallback = State.objects.create(name="Next", group="unstarted", project=project, workspace=project.workspace)
    issue = make_issue_in(project, State.objects.get(project=project, name="Todo"))
    delete(session_client, issue)
    State.all_objects.filter(name="Todo", project=project).update(deleted_at=timezone.now())

    session_client.post(url(project, f"{issue.id}/restore/"))

    assert Issue.objects.get(pk=issue.pk).state == fallback
