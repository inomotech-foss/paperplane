# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from rest_framework import status

from plane.db.models import Issue, IssueSequence, Project, ProjectMember, State, WorkspaceMember


@pytest.fixture
def project(workspace):
    project = Project.objects.create(workspace=workspace, name="Sales Funnel", identifier="ISFUN")
    State.objects.create(workspace=workspace, project=project, name="Backlog", color="#000000", default=True)
    return project


def create_issue(project, name):
    return Issue.objects.create(workspace=project.workspace, project=project, name=name)


def demote_from_workspace_admin(workspace, user):
    """Workspace admins bypass project roles, so tests about project roles need a plain workspace member."""
    WorkspaceMember.objects.filter(workspace=workspace, member=user).update(role=15)


def url(workspace, project):
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/issue-sequence/"


@pytest.mark.contract
@pytest.mark.django_db
class TestProjectIssueSequenceGet:
    def test_reports_the_next_number_for_an_empty_project(self, session_client, workspace, project, create_user):
        ProjectMember.objects.create(project=project, member=create_user, role=15)

        response = session_client.get(url(workspace, project))

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"last_sequence": 0, "next_sequence": 1}

    def test_reports_the_next_number_after_existing_items(self, session_client, workspace, project, create_user):
        ProjectMember.objects.create(project=project, member=create_user, role=20)
        create_issue(project, "First")
        create_issue(project, "Second")

        response = session_client.get(url(workspace, project))

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"last_sequence": 2, "next_sequence": 3}

    def test_guests_cannot_read_it(self, session_client, workspace, project, create_user):
        demote_from_workspace_admin(workspace, create_user)
        ProjectMember.objects.create(project=project, member=create_user, role=5)

        response = session_client.get(url(workspace, project))

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_non_members_cannot_read_it(self, session_client, workspace, project, create_user):
        demote_from_workspace_admin(workspace, create_user)

        response = session_client.get(url(workspace, project))

        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.contract
@pytest.mark.django_db
class TestProjectIssueSequencePost:
    def test_next_item_receives_the_start_number(self, session_client, workspace, project, create_user):
        ProjectMember.objects.create(project=project, member=create_user, role=20)
        first = create_issue(project, "First")

        response = session_client.post(url(workspace, project), {"start": 5000}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"last_sequence": 4999, "next_sequence": 5000}
        assert create_issue(project, "Second").sequence_id == 5000
        assert create_issue(project, "Third").sequence_id == 5001
        first.refresh_from_db()
        assert first.sequence_id == 1

    def test_accepts_a_numeric_string(self, session_client, workspace, project, create_user):
        ProjectMember.objects.create(project=project, member=create_user, role=20)

        response = session_client.post(url(workspace, project), {"start": "5000"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert create_issue(project, "Next").sequence_id == 5000

    def test_rejects_a_start_at_or_below_the_current_maximum(self, session_client, workspace, project, create_user):
        ProjectMember.objects.create(project=project, member=create_user, role=20)
        create_issue(project, "First")
        create_issue(project, "Second")

        response = session_client.post(url(workspace, project), {"start": 2}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "greater than 2" in response.data["error"]
        assert not IssueSequence.objects.filter(project=project, issue__isnull=True).exists()
        assert create_issue(project, "Third").sequence_id == 3

    @pytest.mark.parametrize("start", [1, 0, -5])
    def test_rejects_a_start_below_two(self, session_client, workspace, project, create_user, start):
        ProjectMember.objects.create(project=project, member=create_user, role=20)

        response = session_client.post(url(workspace, project), {"start": start}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "at least 2" in response.data["error"]

    @pytest.mark.parametrize("start", [None, "", "abc", "50.5", True, 12.5])
    def test_rejects_a_start_that_is_not_a_whole_number(self, session_client, workspace, project, create_user, start):
        ProjectMember.objects.create(project=project, member=create_user, role=20)

        response = session_client.post(url(workspace, project), {"start": start}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "whole number" in response.data["error"]
        assert not IssueSequence.objects.filter(project=project).exists()

    def test_members_cannot_change_it(self, session_client, workspace, project, create_user):
        demote_from_workspace_admin(workspace, create_user)
        ProjectMember.objects.create(project=project, member=create_user, role=15)

        response = session_client.post(url(workspace, project), {"start": 5000}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert not IssueSequence.objects.filter(project=project).exists()

    def test_project_must_belong_to_the_workspace(self, session_client, workspace, project, create_user):
        ProjectMember.objects.create(project=project, member=create_user, role=20)

        response = session_client.post(
            f"/api/workspaces/other-workspace/projects/{project.id}/issue-sequence/", {"start": 5000}, format="json"
        )

        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)
