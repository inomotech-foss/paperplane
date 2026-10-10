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
)


@pytest.fixture
def project(db, workspace, create_user):
    """Create a test project with the user as a member"""
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
def task_type(db, workspace, project, create_user):
    issue_type = IssueType.objects.create(workspace=workspace, name="Task", is_epic=False, is_active=True)
    ProjectIssueType.objects.create(project=project, issue_type=issue_type, workspace=workspace)
    return issue_type


def type_url(workspace_slug, project_id, issue_type_id=None):
    url = f"/api/v1/workspaces/{workspace_slug}/projects/{project_id}/work-item-types/"
    if issue_type_id:
        url = f"{url}{issue_type_id}/"
    return url


@pytest.mark.contract
class TestIssueTypeCRUD:
    """Test work item type CRUD endpoints"""

    @pytest.mark.django_db
    def test_create_type(self, api_key_client, workspace, project):
        response = api_key_client.post(
            type_url(workspace.slug, project.id),
            {"name": "Bug"},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Bug"
        assert response.data["is_epic"] is False
        assert IssueType.objects.filter(workspace=workspace, name="Bug").count() == 1
        assert ProjectIssueType.objects.filter(project=project, issue_type_id=response.data["id"]).exists()

    @pytest.mark.django_db
    def test_create_type_forces_is_epic_false(self, api_key_client, workspace, project):
        response = api_key_client.post(
            type_url(workspace.slug, project.id),
            {"name": "Epic Attempt", "is_epic": True},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["is_epic"] is False
        issue_type = IssueType.objects.get(pk=response.data["id"])
        assert issue_type.is_epic is False

    @pytest.mark.django_db
    def test_list_returns_the_linked_types_and_creates_none(self, api_key_client, workspace, project, task_type):
        IssueType.objects.create(workspace=workspace, name="Unlinked")

        response = api_key_client.get(type_url(workspace.slug, project.id))

        assert response.status_code == status.HTTP_200_OK
        assert [issue_type["name"] for issue_type in response.data] == ["Task"]
        assert "is_default" not in response.data[0]
        assert IssueType.objects.filter(workspace=workspace).count() == 2

    @pytest.mark.django_db
    def test_retrieve_type(self, api_key_client, workspace, project, task_type):
        response = api_key_client.get(type_url(workspace.slug, project.id, task_type.id))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Task"

    @pytest.mark.django_db
    def test_patch_type(self, api_key_client, workspace, project, task_type):
        response = api_key_client.patch(
            type_url(workspace.slug, project.id, task_type.id),
            {"name": "Renamed Task", "description": "Updated"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        task_type.refresh_from_db()
        assert task_type.name == "Renamed Task"
        assert task_type.description == "Updated"

    @pytest.mark.django_db
    def test_patch_is_epic_rejected(self, api_key_client, workspace, project, task_type):
        response = api_key_client.patch(
            type_url(workspace.slug, project.id, task_type.id),
            {"is_epic": True},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        task_type.refresh_from_db()
        assert task_type.is_epic is False

    @pytest.mark.django_db
    def test_delete_type(self, api_key_client, workspace, project, task_type):
        other = IssueType.objects.create(workspace=workspace, name="Story", is_epic=False)
        ProjectIssueType.objects.create(project=project, issue_type=other, workspace=workspace)

        response = api_key_client.delete(type_url(workspace.slug, project.id, other.id))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not ProjectIssueType.objects.filter(project=project, issue_type=other).exists()
        # Not linked to any other project: the IssueType row itself is cleaned up
        assert not IssueType.objects.filter(pk=other.id).exists()

    @pytest.mark.django_db
    def test_delete_type_still_linked_elsewhere_keeps_row(self, api_key_client, workspace, project, task_type):
        other_project = Project.objects.create(
            name="Other Project",
            identifier="OP",
            workspace=workspace,
            created_by=task_type.created_by,
        )
        other = IssueType.objects.create(workspace=workspace, name="Story", is_epic=False)
        ProjectIssueType.objects.create(project=project, issue_type=other, workspace=workspace)
        ProjectIssueType.objects.create(project=other_project, issue_type=other, workspace=workspace)

        response = api_key_client.delete(type_url(workspace.slug, project.id, other.id))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not ProjectIssueType.objects.filter(project=project, issue_type=other).exists()
        # Still linked to another project: the IssueType row survives
        assert IssueType.objects.filter(pk=other.id).exists()

    @pytest.mark.django_db
    def test_delete_epic_type_rejected(self, api_key_client, workspace, project, task_type):
        epic = IssueType.objects.create(workspace=workspace, name="Epic", is_epic=True)
        ProjectIssueType.objects.create(project=project, issue_type=epic, workspace=workspace)

        response = api_key_client.delete(type_url(workspace.slug, project.id, epic.id))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert ProjectIssueType.objects.filter(project=project, issue_type=epic).exists()

    @pytest.mark.django_db
    def test_delete_last_remaining_type_rejected(self, api_key_client, workspace, project):
        # Only one (non-default, non-epic) active type enabled for the project
        only_type = IssueType.objects.create(workspace=workspace, name="Task", is_epic=False)
        ProjectIssueType.objects.create(project=project, issue_type=only_type, workspace=workspace)

        response = api_key_client.delete(type_url(workspace.slug, project.id, only_type.id))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert ProjectIssueType.objects.filter(project=project, issue_type=only_type).exists()

    @pytest.mark.django_db
    def test_unauthenticated_request_rejected(self, api_client, db, workspace, project):
        response = api_client.get(type_url(workspace.slug, project.id))

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
