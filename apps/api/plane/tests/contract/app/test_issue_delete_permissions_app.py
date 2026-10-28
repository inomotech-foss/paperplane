# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import APIToken, Issue, Project, ProjectMember, State, User, WorkspaceMember
from plane.utils.issue_type import link_starter_type

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture(autouse=True)
def no_tasks(mocker):
    mocker.patch("plane.db.mixins.soft_delete_related_objects.delay")
    mocker.patch("plane.app.views.issue.base.issue_activity.delay")
    mocker.patch("plane.api.views.issue.issue_activity.delay")


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="Nova", identifier="NOVA", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    State.objects.create(name="Todo", group="unstarted", project=project, workspace=workspace, default=True)
    return project


@pytest.fixture
def issue(project, create_user):
    return Issue.objects.create(
        name="Imported",
        project=project,
        state=State.objects.get(project=project),
        type=link_starter_type(project),
        created_by=create_user,
    )


def join(project, role):
    user = User.objects.create(email=f"role{role}@plane.so", username=f"role{role}")
    WorkspaceMember.objects.create(workspace=project.workspace, member=user, role=role)
    ProjectMember.objects.create(project=project, member=user, role=role)
    return user


def session(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def issue_url(issue):
    return f"/api/workspaces/{issue.project.workspace.slug}/projects/{issue.project_id}/issues/{issue.id}/"


def test_members_can_delete_work_items_they_did_not_create(project, issue):
    response = session(join(project, 15)).delete(issue_url(issue))

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert not Issue.objects.filter(pk=issue.pk).exists()


def test_guests_cannot_delete_work_items_of_others(project, issue):
    response = session(join(project, 5)).delete(issue_url(issue))

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert Issue.objects.filter(pk=issue.pk).exists()


def test_guests_can_delete_their_own_work_items(project, issue):
    guest = join(project, 5)
    Issue.objects.filter(pk=issue.pk).update(created_by=guest)

    response = session(guest).delete(issue_url(issue))

    assert response.status_code == status.HTTP_204_NO_CONTENT


def test_members_can_bulk_delete(project, issue):
    response = session(join(project, 15)).delete(
        f"/api/workspaces/{project.workspace.slug}/projects/{project.id}/bulk-delete-issues/",
        {"issue_ids": [str(issue.id)]},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert not Issue.objects.filter(pk=issue.pk).exists()


@pytest.mark.parametrize(("role", "expected"), [(15, status.HTTP_204_NO_CONTENT), (5, status.HTTP_403_FORBIDDEN)])
def test_public_api_lets_members_delete(project, issue, role, expected):
    user = join(project, role)
    token = APIToken.objects.create(user=user, label="Test", token=f"token-{role}")
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=token.token)

    response = client.delete(f"/api/v1/workspaces/{project.workspace.slug}/projects/{project.id}/issues/{issue.id}/")

    assert response.status_code == expected
