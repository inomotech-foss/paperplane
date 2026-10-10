# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Work items that arrive through an intake get the intake's type."""

from unittest import mock

import pytest
from rest_framework import status

from plane.db.models import (
    DeployBoard,
    Intake,
    Issue,
    IssueType,
    Project,
    ProjectIssueType,
    ProjectMember,
    WorkspaceMember,
)
from plane.utils.issue_type import link_starter_type


@pytest.fixture(autouse=True)
def _no_activity(db):
    with (
        mock.patch("plane.app.views.intake.base.issue_activity"),
        mock.patch("plane.app.views.intake.base.issue_description_version_task"),
        mock.patch("plane.api.views.intake.issue_activity"),
        mock.patch("plane.space.views.intake.issue_activity"),
    ):
        yield


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(
        name="Support", identifier="SUP", workspace=workspace, created_by=create_user, intake_view=True
    )
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    link_starter_type(project)
    return project


@pytest.fixture
def ticket(db, workspace, project):
    issue_type = IssueType.objects.create(workspace=workspace, name="Ticket")
    ProjectIssueType.objects.create(project=project, issue_type=issue_type, workspace=workspace)
    return issue_type


@pytest.fixture
def intake(db, workspace, project, ticket):
    return Intake.objects.create(
        name="Intake", project=project, workspace=workspace, is_default=True, issue_type=ticket
    )


def intake_url(workspace, project, intake=None):
    base = f"/api/workspaces/{workspace.slug}/projects/{project.id}/intakes/"
    return f"{base}{intake.id}/" if intake else base


@pytest.mark.contract
@pytest.mark.django_db
class TestIntakeCreatesItsType:
    def test_app_intake_item(self, session_client, workspace, project, intake, ticket):
        task = link_starter_type(project)
        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/intake-issues/",
            {"issue": {"name": "Printer", "type_id": str(task.id)}},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK, response.data
        assert Issue.objects.get(name="Printer").type_id == ticket.id

    def test_public_api_intake_item(self, api_key_client, workspace, project, intake, ticket):
        response = api_key_client.post(
            f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/intake-issues/",
            {"issue": {"name": "Printer"}},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert Issue.objects.get(name="Printer").type_id == ticket.id

    def test_published_board_intake_item(self, session_client, workspace, project, intake, ticket):
        board = DeployBoard.objects.create(
            entity_name="project", entity_identifier=project.id, project=project, workspace=workspace, intake=intake
        )

        response = session_client.post(
            f"/api/public/anchor/{board.anchor}/intakes/{intake.id}/intake-issues/",
            {"issue": {"name": "Printer"}},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK, response.data
        assert Issue.objects.get(name="Printer").type_id == ticket.id


@pytest.mark.contract
@pytest.mark.django_db
class TestIntakeTypeSetting:
    def test_list_returns_the_intake_type(self, session_client, workspace, project, intake, ticket):
        response = session_client.get(intake_url(workspace, project))

        assert response.status_code == status.HTTP_200_OK
        assert str(response.data["issue_type"]) == str(ticket.id)

    def test_admin_changes_the_type(self, session_client, workspace, project, intake):
        task = link_starter_type(project)

        response = session_client.patch(intake_url(workspace, project, intake), {"issue_type": str(task.id)})

        assert response.status_code == status.HTTP_200_OK, response.data
        intake.refresh_from_db()
        assert intake.issue_type_id == task.id

    def test_a_type_not_linked_to_the_project_is_rejected(self, session_client, workspace, project, intake, ticket):
        other = IssueType.objects.create(workspace=workspace, name="Elsewhere")

        response = session_client.patch(intake_url(workspace, project, intake), {"issue_type": str(other.id)})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        intake.refresh_from_db()
        assert intake.issue_type_id == ticket.id

    def test_a_member_cannot_change_the_type(self, session_client, workspace, project, intake, ticket, create_user):
        ProjectMember.objects.filter(project=project, member=create_user).update(role=15)
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)

        response = session_client.patch(
            intake_url(workspace, project, intake), {"issue_type": str(link_starter_type(project).id)}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        intake.refresh_from_db()
        assert intake.issue_type_id == ticket.id


@pytest.mark.contract
@pytest.mark.django_db
class TestProjectTypes:
    def test_a_new_project_starts_with_the_task_type(self, session_client, workspace):
        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/projects/", {"name": "New", "identifier": "NEW"}, format="json"
        )

        assert response.status_code == status.HTTP_201_CREATED
        linked = IssueType.objects.filter(project_issue_types__project_id=response.data["id"])
        assert list(linked.values_list("name", flat=True)) == ["Task"]

    def test_a_new_project_reuses_the_workspace_task_type(self, session_client, workspace, project):
        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/projects/", {"name": "New", "identifier": "NEW"}, format="json"
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert IssueType.objects.filter(workspace=workspace, name="Task").count() == 1

    def test_enabling_intake_creates_one_with_the_first_type(self, session_client, workspace, create_user):
        project = Project.objects.create(name="Ops", identifier="OPS", workspace=workspace, created_by=create_user)
        ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
        for name, level in (("Zebra", 0), ("Alpha", 1)):
            issue_type = IssueType.objects.create(workspace=workspace, name=name, level=level)
            ProjectIssueType.objects.create(project=project, issue_type=issue_type, workspace=workspace)

        response = session_client.patch(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/", {"inbox_view": True}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK, response.data
        assert Intake.objects.get(project=project).issue_type.name == "Zebra"
