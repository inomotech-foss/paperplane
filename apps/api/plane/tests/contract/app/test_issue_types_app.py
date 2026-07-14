# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from rest_framework import status

from plane.db.models import (
    IssueType,
    Project,
    ProjectIssueType,
    ProjectMember,
    WorkspaceMember,
)


@pytest.fixture
def project(db, workspace, create_user):
    """Create a test project with the user as an admin member"""
    project = Project.objects.create(
        name="Test Project",
        identifier="TP",
        workspace=workspace,
        created_by=create_user,
    )
    ProjectMember.objects.create(
        project=project,
        member=create_user,
        role=20,  # Admin role
        is_active=True,
    )
    return project


@pytest.fixture
def default_type(db, workspace, project, create_user):
    issue_type = IssueType.objects.create(
        workspace=workspace,
        name="Task",
        is_epic=False,
        is_default=True,
        is_active=True,
    )
    ProjectIssueType.objects.create(
        project=project,
        issue_type=issue_type,
        workspace=workspace,
        is_default=True,
    )
    return issue_type


class IssueTypeAppUrls:
    def types_url(self, slug, project_id, issue_type_id=None):
        base = f"/api/workspaces/{slug}/projects/{project_id}/issue-types/"
        return f"{base}{issue_type_id}/" if issue_type_id else base


@pytest.mark.contract
@pytest.mark.django_db
class TestIssueTypeAppCrud(IssueTypeAppUrls):
    def test_create_type(self, session_client, workspace, project):
        url = self.types_url(workspace.slug, project.id)
        response = session_client.post(url, {"name": "Bug"}, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Bug"
        assert response.data["is_epic"] is False
        assert IssueType.objects.filter(workspace=workspace, name="Bug").count() == 1
        assert ProjectIssueType.objects.filter(project=project, issue_type_id=response.data["id"]).exists()

    def test_create_type_forces_is_epic_false(self, session_client, workspace, project):
        url = self.types_url(workspace.slug, project.id)
        response = session_client.post(url, {"name": "Epic Attempt", "is_epic": True}, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["is_epic"] is False

    def test_create_default_type_unsets_previous_default(self, session_client, workspace, project, default_type):
        url = self.types_url(workspace.slug, project.id)
        response = session_client.post(url, {"name": "Story", "is_default": True}, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        default_type.refresh_from_db()
        assert default_type.is_default is False
        assert IssueType.objects.filter(workspace=workspace, is_default=True).count() == 1

    def test_list_types_lazily_provisions_default(self, session_client, workspace, project):
        assert not IssueType.objects.filter(workspace=workspace).exists()

        url = self.types_url(workspace.slug, project.id)
        response = session_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Task"
        assert IssueType.objects.filter(workspace=workspace, is_default=True).count() == 1

    def test_update_type(self, session_client, workspace, project, default_type):
        url = self.types_url(workspace.slug, project.id, default_type.id)
        response = session_client.patch(url, {"name": "Renamed"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        default_type.refresh_from_db()
        assert default_type.name == "Renamed"

    def test_is_epic_is_immutable(self, session_client, workspace, project, default_type):
        url = self.types_url(workspace.slug, project.id, default_type.id)
        response = session_client.patch(url, {"is_epic": True}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        default_type.refresh_from_db()
        assert default_type.is_epic is False

    def test_delete_type(self, session_client, workspace, project, default_type):
        other = IssueType.objects.create(workspace=workspace, name="Story", is_epic=False)
        ProjectIssueType.objects.create(project=project, issue_type=other, workspace=workspace)

        url = self.types_url(workspace.slug, project.id, other.id)
        response = session_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not ProjectIssueType.objects.filter(project=project, issue_type=other).exists()

    def test_delete_epic_type_rejected(self, session_client, workspace, project, default_type):
        epic = IssueType.objects.create(workspace=workspace, name="Epic", is_epic=True)
        ProjectIssueType.objects.create(project=project, issue_type=epic, workspace=workspace)

        url = self.types_url(workspace.slug, project.id, epic.id)
        response = session_client.delete(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_delete_default_type_rejected(self, session_client, workspace, project, default_type):
        other = IssueType.objects.create(workspace=workspace, name="Story", is_epic=False)
        ProjectIssueType.objects.create(project=project, issue_type=other, workspace=workspace)

        url = self.types_url(workspace.slug, project.id, default_type.id)
        response = session_client.delete(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_delete_last_remaining_type_rejected(self, session_client, workspace, project):
        only_type = IssueType.objects.create(workspace=workspace, name="Task", is_epic=False)
        ProjectIssueType.objects.create(project=project, issue_type=only_type, workspace=workspace)

        url = self.types_url(workspace.slug, project.id, only_type.id)
        response = session_client.delete(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_member_cannot_create_type(self, session_client, workspace, project, create_user):
        ProjectMember.objects.filter(project=project, member=create_user).update(role=15)
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)
        url = self.types_url(workspace.slug, project.id)
        response = session_client.post(url, {"name": "Bug"}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
