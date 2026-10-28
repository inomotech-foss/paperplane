# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import APIToken, Issue, Project, ProjectMember, State, User, WorkspaceMember
from plane.utils.issue_type import link_starter_type

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture(autouse=True)
def no_tasks(mocker):
    mocker.patch("plane.utils.work_item_trash.issue_activity.delay")


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="Nova", identifier="NOVA", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    State.objects.create(name="Todo", group="unstarted", project=project, workspace=workspace, default=True)
    return project


def make_issue(project, name, parent=None, deleted=False):
    issue = Issue.objects.create(
        name=name,
        project=project,
        state=State.objects.get(project=project),
        parent=parent,
        type=link_starter_type(project),
    )
    if deleted:
        Issue.objects.filter(pk=issue.pk).update(deleted_at=timezone.now())
    return issue


def client_for(project, role):
    user = User.objects.create(email=f"role{role}@plane.so", username=f"role{role}")
    WorkspaceMember.objects.create(workspace=project.workspace, member=user, role=role)
    ProjectMember.objects.create(project=project, member=user, role=role)
    token = APIToken.objects.create(user=user, label="Test", token=f"token-{role}")
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=token.token)
    return client


def url(project, suffix=""):
    return f"/api/v1/workspaces/{project.workspace.slug}/projects/{project.id}/deleted-work-items/{suffix}"


def test_members_list_deleted_work_items(project):
    make_issue(project, "Gone", deleted=True)
    make_issue(project, "Alive")

    response = client_for(project, 15).get(url(project))

    assert response.status_code == status.HTTP_200_OK
    assert [item["name"] for item in response.data["results"]] == ["Gone"]


def test_members_restore_a_deleted_work_item(project):
    issue = make_issue(project, "Gone", deleted=True)

    response = client_for(project, 15).post(url(project, f"{issue.id}/restore/"))

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert Issue.objects.filter(pk=issue.pk).exists()


def test_restoring_a_live_work_item_is_not_found(project):
    issue = make_issue(project, "Alive")

    response = client_for(project, 15).post(url(project, f"{issue.id}/restore/"))

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.parametrize("suffix", ["", "restore/"])
def test_guests_cannot_use_the_trash(project, suffix):
    issue = make_issue(project, "Gone", deleted=True)
    client = client_for(project, 5)
    target = url(project, f"{issue.id}/{suffix}") if suffix else url(project)

    response = client.post(target) if suffix else client.get(target)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert not Issue.objects.filter(pk=issue.pk).exists()


def test_the_list_pages_by_twenty_by_default(project):
    for number in range(21):
        make_issue(project, f"Gone {number}", deleted=True)

    response = client_for(project, 15).get(url(project))

    assert len(response.data["results"]) == 20
    assert response.data["next_page_results"] is True
