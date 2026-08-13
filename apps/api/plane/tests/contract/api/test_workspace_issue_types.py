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
    project = Project.objects.create(
        name="Test Project",
        identifier="TP",
        workspace=workspace,
        created_by=create_user,
    )
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def other_project(db, workspace, create_user):
    project = Project.objects.create(
        name="Other Project",
        identifier="OP",
        workspace=workspace,
        created_by=create_user,
    )
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def default_type(db, workspace, project):
    issue_type = IssueType.objects.create(workspace=workspace, name="Task", is_default=True)
    ProjectIssueType.objects.create(project=project, issue_type=issue_type, workspace=workspace, is_default=True)
    return issue_type


@pytest.fixture
def loose_type(db, workspace):
    """A workspace type no project has enabled."""
    return IssueType.objects.create(workspace=workspace, name="Spike")


def workspace_url(slug, issue_type_id=None):
    url = f"/api/v1/workspaces/{slug}/work-item-types/"
    return f"{url}{issue_type_id}/" if issue_type_id else url


def import_url(slug, project_id):
    return f"/api/v1/workspaces/{slug}/projects/{project_id}/import-work-item-types/"


@pytest.mark.contract
class TestWorkspaceIssueTypes:
    @pytest.mark.django_db
    def test_list_returns_a_bare_array(self, api_key_client, workspace, default_type):
        response = api_key_client.get(workspace_url(workspace.slug))

        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, list)
        assert [t["name"] for t in response.data] == ["Task"]

    @pytest.mark.django_db
    def test_list_includes_types_no_project_uses(self, api_key_client, workspace, default_type, loose_type):
        response = api_key_client.get(workspace_url(workspace.slug))

        assert {t["name"] for t in response.data} == {"Task", "Spike"}

    @pytest.mark.django_db
    def test_each_type_reports_the_projects_it_is_enabled_for(
        self, api_key_client, workspace, project, default_type, loose_type
    ):
        by_name = {t["name"]: t for t in api_key_client.get(workspace_url(workspace.slug)).data}

        assert by_name["Task"]["project_ids"] == [str(project.id)]
        assert by_name["Spike"]["project_ids"] == []

    @pytest.mark.django_db
    def test_create_without_projects_attaches_nowhere(self, api_key_client, workspace):
        response = api_key_client.post(workspace_url(workspace.slug), {"name": "Spike"}, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["project_ids"] == []
        assert not ProjectIssueType.objects.filter(issue_type_id=response.data["id"]).exists()

    @pytest.mark.django_db
    def test_create_enables_the_named_projects(self, api_key_client, workspace, project, other_project):
        response = api_key_client.post(
            workspace_url(workspace.slug),
            {"name": "Spike", "project_ids": [str(project.id), str(other_project.id)]},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert set(response.data["project_ids"]) == {str(project.id), str(other_project.id)}

    @pytest.mark.django_db
    def test_create_refuses_a_project_from_another_workspace(self, api_key_client, workspace, create_user):
        from plane.db.models import Workspace

        other = Workspace.objects.create(name="Other", owner=create_user, slug="other-workspace")
        outside = Project.objects.create(name="Outside", identifier="OU", workspace=other, created_by=create_user)

        response = api_key_client.post(
            workspace_url(workspace.slug),
            {"name": "Spike", "project_ids": [str(outside.id)]},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not IssueType.objects.filter(name="Spike").exists()

    @pytest.mark.django_db
    def test_is_epic_cannot_be_set(self, api_key_client, workspace):
        response = api_key_client.post(
            workspace_url(workspace.slug), {"name": "Sneaky", "is_epic": True}, format="json"
        )

        assert IssueType.objects.get(pk=response.data["id"]).is_epic is False

    @pytest.mark.django_db
    def test_retrieve_and_patch(self, api_key_client, workspace, loose_type):
        retrieved = api_key_client.get(workspace_url(workspace.slug, loose_type.id))
        assert retrieved.data["name"] == "Spike"

        response = api_key_client.patch(
            workspace_url(workspace.slug, loose_type.id), {"name": "Research"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        loose_type.refresh_from_db()
        assert loose_type.name == "Research"

    @pytest.mark.django_db
    def test_patch_to_default_unsets_the_previous_default(self, api_key_client, workspace, default_type, loose_type):
        api_key_client.patch(workspace_url(workspace.slug, loose_type.id), {"is_default": True}, format="json")

        default_type.refresh_from_db()
        assert default_type.is_default is False
        assert IssueType.objects.filter(workspace=workspace, is_default=True).count() == 1

    @pytest.mark.django_db
    def test_delete_removes_the_type_and_its_links(self, api_key_client, workspace, project, default_type, loose_type):
        ProjectIssueType.objects.create(project=project, issue_type=loose_type, workspace=workspace)

        response = api_key_client.delete(workspace_url(workspace.slug, loose_type.id))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not IssueType.objects.filter(pk=loose_type.id).exists()
        assert not ProjectIssueType.objects.filter(issue_type_id=loose_type.id).exists()

    @pytest.mark.django_db
    def test_delete_the_default_is_rejected(self, api_key_client, workspace, default_type):
        response = api_key_client.delete(workspace_url(workspace.slug, default_type.id))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert IssueType.objects.filter(pk=default_type.id).exists()

    @pytest.mark.django_db
    def test_delete_is_rejected_when_it_would_strand_a_project(self, api_key_client, workspace, project, loose_type):
        # loose_type is the project's only type, so removing it leaves none.
        ProjectIssueType.objects.create(project=project, issue_type=loose_type, workspace=workspace)

        response = api_key_client.delete(workspace_url(workspace.slug, loose_type.id))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert str(project.id) in response.data["error"]

    @pytest.mark.django_db
    def test_unauthenticated_request_rejected(self, api_client, workspace):
        response = api_client.get(workspace_url(workspace.slug))

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.contract
class TestIssueTypeImport:
    @pytest.mark.django_db
    def test_import_enables_a_workspace_type_for_the_project(
        self, api_key_client, workspace, project, default_type, loose_type
    ):
        response = api_key_client.post(
            import_url(workspace.slug, project.id),
            {"work_item_types": [str(loose_type.id)]},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert {t["name"] for t in response.data} == {"Task", "Spike"}
        assert ProjectIssueType.objects.filter(project=project, issue_type=loose_type).exists()

    @pytest.mark.django_db
    def test_importing_twice_does_not_duplicate(self, api_key_client, workspace, project, default_type, loose_type):
        body = {"work_item_types": [str(loose_type.id)]}
        api_key_client.post(import_url(workspace.slug, project.id), body, format="json")
        api_key_client.post(import_url(workspace.slug, project.id), body, format="json")

        assert ProjectIssueType.objects.filter(project=project, issue_type=loose_type).count() == 1

    @pytest.mark.django_db
    def test_a_type_from_another_workspace_is_refused(self, api_key_client, workspace, project, create_user):
        from plane.db.models import Workspace

        other = Workspace.objects.create(name="Other", owner=create_user, slug="other-workspace")
        foreign = IssueType.objects.create(workspace=other, name="Foreign")

        response = api_key_client.post(
            import_url(workspace.slug, project.id),
            {"work_item_types": [str(foreign.id)]},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not ProjectIssueType.objects.filter(issue_type=foreign).exists()

    @pytest.mark.django_db
    def test_a_non_list_body_is_refused(self, api_key_client, workspace, project, default_type):
        response = api_key_client.post(
            import_url(workspace.slug, project.id),
            {"work_item_types": "not-a-list"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
