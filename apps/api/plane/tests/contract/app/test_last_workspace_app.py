# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the profile's last workspace."""

import pytest
from rest_framework import status

from plane.db.models import Profile, Project, ProjectMember, Workspace, WorkspaceMember, WorkspaceMemberInvite

LAST_VISITED_URL = "/api/users/last-visited-workspace/"


@pytest.fixture
def profile(create_user):
    return Profile.objects.create(user=create_user)


@pytest.mark.contract
@pytest.mark.django_db
class TestLastVisitedWorkspace:
    def test_without_last_workspace(self, session_client, profile):
        response = session_client.get(LAST_VISITED_URL)
        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"project_details": [], "workspace_details": {}}

    def test_returns_workspace_and_projects(self, session_client, profile, workspace, create_user):
        project = Project.objects.create(name="P", identifier="P", workspace=workspace, created_by=create_user)
        ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
        profile.last_workspace_id = workspace.id
        profile.save()

        response = session_client.get(LAST_VISITED_URL)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["workspace_details"]["slug"] == workspace.slug
        assert [str(p["project"]["id"]) for p in response.data["project_details"]] == [str(project.id)]

    def test_ignores_workspace_the_user_left(self, session_client, profile, create_user):
        other = Workspace.objects.create(name="Other", owner=create_user, slug="other")
        WorkspaceMember.objects.create(workspace=other, member=create_user, role=15, is_active=False)
        profile.last_workspace_id = other.id
        profile.save()

        response = session_client.get(LAST_VISITED_URL)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["workspace_details"] == {}


@pytest.mark.contract
@pytest.mark.django_db
class TestJoinSetsLastWorkspace:
    def test_accepting_an_invitation_sets_last_workspace(self, session_client, profile, create_user):
        other = Workspace.objects.create(name="Other", owner=create_user, slug="other")
        invite = WorkspaceMemberInvite.objects.create(workspace=other, email=create_user.email, token="t", role=15)

        response = session_client.post(
            f"/api/workspaces/{other.slug}/invitations/{invite.id}/join/",
            {"token": "t", "accepted": True},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        profile.refresh_from_db()
        assert profile.last_workspace_id == other.id
