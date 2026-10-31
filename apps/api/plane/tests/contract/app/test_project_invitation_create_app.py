# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for creating project invitations."""

from unittest import mock

import pytest
from rest_framework import status

from plane.db.models import Project, ProjectMember, ProjectMemberInvite, User, WorkspaceMember


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="P", identifier="P", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    return project


def _url(workspace, project):
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/invitations/"


@pytest.mark.contract
@pytest.mark.django_db
class TestProjectInvitationCreate:
    def test_creates_and_sends_invitations(self, session_client, workspace, project):
        with mock.patch("plane.app.views.project.invite.project_invitation.delay") as delay:
            response = session_client.post(
                _url(workspace, project), {"emails": [{"email": "New@plane.so", "role": 15}]}, format="json"
            )

        assert response.status_code == status.HTTP_200_OK
        invite = ProjectMemberInvite.objects.get(project=project)
        assert (invite.email, invite.role) == ("new@plane.so", 15)
        delay.assert_called_once()
        assert delay.call_args.args[0] == "new@plane.so"

    def test_rejects_a_role_other_than_the_workspace_role(self, session_client, workspace, project):
        guest = User.objects.create(email="guest@plane.so", username="guest")
        WorkspaceMember.objects.create(workspace=workspace, member=guest, role=5)

        with mock.patch("plane.app.views.project.invite.project_invitation.delay") as delay:
            response = session_client.post(
                _url(workspace, project), {"emails": [{"email": "guest@plane.so", "role": 15}]}, format="json"
            )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not ProjectMemberInvite.objects.filter(project=project).exists()
        delay.assert_not_called()
