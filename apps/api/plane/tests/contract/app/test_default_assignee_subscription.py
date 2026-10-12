# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from rest_framework import status

from plane.db.models import Issue, IssueSubscriber, Project, ProjectMember, State, User, WorkspaceMember
from plane.utils.issue_type import link_starter_type

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture(autouse=True)
def no_celery(mocker):
    mocker.patch("plane.bgtasks.issue_activities_task.issue_activity.delay")
    mocker.patch("plane.bgtasks.webhook_task.model_activity.delay")


@pytest.fixture
def lead(workspace):
    user = User.objects.create(email="lead@plane.so", username="lead")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15, is_active=True)
    return user


@pytest.fixture
def project(workspace, create_user, lead):
    project = Project.objects.create(
        name="Default", identifier="DEF", workspace=workspace, created_by=create_user, default_assignee=lead
    )
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    ProjectMember.objects.create(project=project, member=lead, role=15, is_active=True)
    State.objects.create(name="Backlog", group="backlog", default=True, project=project, workspace=workspace)
    return project


def assert_lead_is_assigned_and_subscribed(lead):
    issue = Issue.objects.get(name="Unassigned")
    assert list(issue.assignees.all()) == [lead]
    assert IssueSubscriber.objects.filter(issue=issue, subscriber=lead).exists()


def test_app_default_assignee_is_subscribed(session_client, workspace, project, lead):
    response = session_client.post(
        f"/api/workspaces/{workspace.slug}/projects/{project.id}/issues/",
        {"name": "Unassigned", "type_id": str(link_starter_type(project).id)},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert_lead_is_assigned_and_subscribed(lead)


def test_api_default_assignee_is_subscribed(api_key_client, workspace, project, lead):
    response = api_key_client.post(
        f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/issues/",
        {"name": "Unassigned", "type_id": str(link_starter_type(project).id)},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert_lead_is_assigned_and_subscribed(lead)
