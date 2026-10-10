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
    Workspace,
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


def post_intake_item(request, kind, workspace, project, intake, issue):
    """Send `issue` to the intake the way `kind` does. Returns the response and the success status."""
    if kind == "app":
        client, url, created = (
            request.getfixturevalue("session_client"),
            "/api/workspaces/{}/projects/{}/intake-issues/",
            200,
        )
        url = url.format(workspace.slug, project.id)
    elif kind == "v1":
        client, created = request.getfixturevalue("api_key_client"), 201
        url = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/intake-issues/"
    else:
        client, created = request.getfixturevalue("session_client"), 200
        board = DeployBoard.objects.create(
            entity_name="project", entity_identifier=project.id, project=project, workspace=workspace, intake=intake
        )
        url = f"/api/public/anchor/{board.anchor}/intakes/{intake.id}/intake-issues/"
    return client.post(url, {"issue": issue}, format="json"), created


INTAKE_PATHS = ["app", "v1", "public_board"]


@pytest.mark.contract
@pytest.mark.django_db
class TestIntakeCreatesItsType:
    @pytest.mark.parametrize("kind", INTAKE_PATHS)
    def test_an_omitted_type_is_the_intake_type(self, request, kind, workspace, project, intake, ticket):
        response, created = post_intake_item(request, kind, workspace, project, intake, {"name": "Printer"})

        assert response.status_code == created, response.data
        assert Issue.objects.get(name="Printer").type_id == ticket.id

    @pytest.mark.parametrize("kind", INTAKE_PATHS)
    def test_the_intake_type_is_accepted(self, request, kind, workspace, project, intake, ticket):
        issue = {"name": "Printer", "type_id": str(ticket.id)}
        response, created = post_intake_item(request, kind, workspace, project, intake, issue)

        assert response.status_code == created, response.data
        assert Issue.objects.get(name="Printer").type_id == ticket.id

    @pytest.mark.parametrize("kind", INTAKE_PATHS)
    def test_another_type_is_rejected(self, request, kind, workspace, project, intake, ticket):
        issue = {"name": "Printer", "type_id": str(link_starter_type(project).id)}
        response, _ = post_intake_item(request, kind, workspace, project, intake, issue)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["type_id"] == "Work items of this intake get the type Ticket."
        assert not Issue.objects.filter(name="Printer").exists()


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

    @pytest.mark.parametrize("api", ["app", "v1"])
    def test_a_new_project_with_intake_on_needs_its_type(self, request, api, workspace):
        client, url = project_create(request, api, workspace)

        response = client.post(url, {"name": "New", "identifier": "NEW", "intake_view": True}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "intake_issue_type_id" in response.data
        assert not Project.objects.filter(identifier="NEW").exists()

    @pytest.mark.parametrize("api", ["app", "v1"])
    @pytest.mark.parametrize("kind", ["epic", "foreign"])
    def test_the_intake_type_must_be_a_workspace_type(self, request, api, kind, workspace, create_user):
        if kind == "epic":
            issue_type = IssueType.objects.create(workspace=workspace, name="Epic", is_epic=True)
        else:
            other = Workspace.objects.create(name="Other", slug="other", owner=create_user)
            issue_type = IssueType.objects.create(workspace=other, name="Ticket")
        client, url = project_create(request, api, workspace)

        response = client.post(
            url,
            {"name": "New", "identifier": "NEW", "intake_view": True, "intake_issue_type_id": str(issue_type.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not Project.objects.filter(identifier="NEW").exists()

    @pytest.mark.parametrize("api", ["app", "v1"])
    def test_a_new_project_starts_with_its_intake_type(self, request, api, workspace):
        ticket = IssueType.objects.create(workspace=workspace, name="Ticket")
        client, url = project_create(request, api, workspace)

        response = client.post(
            url,
            {"name": "New", "identifier": "NEW", "intake_view": True, "intake_issue_type_id": str(ticket.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED, response.data
        project = Project.objects.get(identifier="NEW")
        assert project.intake_view is True
        assert Intake.objects.get(project=project).issue_type_id == ticket.id
        linked = IssueType.objects.filter(project_issue_types__project=project, project_issue_types__deleted_at=None)
        assert set(linked.values_list("name", flat=True)) == {"Task", "Ticket"}


def project_create(request, api, workspace):
    if api == "app":
        return request.getfixturevalue("session_client"), f"/api/workspaces/{workspace.slug}/projects/"
    return request.getfixturevalue("api_key_client"), f"/api/v1/workspaces/{workspace.slug}/projects/"


def enable_with(request, kind, workspace, project, data):
    """Turn intake on the way `kind` does."""
    if kind == "app":
        url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/"
        return request.getfixturevalue("session_client").patch(url, {"inbox_view": True, **data}, format="json")
    if kind == "v1":
        url = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/"
        return request.getfixturevalue("api_key_client").patch(url, {"intake_view": True, **data}, format="json")
    url = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/features/"
    return request.getfixturevalue("api_key_client").patch(url, {"intakes": True, **data}, format="json")


@pytest.fixture
def ops(db, workspace, create_user):
    project = Project.objects.create(name="Ops", identifier="OPS", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    link_starter_type(project)
    return project


@pytest.mark.contract
@pytest.mark.django_db
class TestEnablingIntake:
    @pytest.mark.parametrize("kind", ["app", "v1", "features"])
    def test_turning_intake_on_needs_its_type(self, request, kind, workspace, ops):
        response = enable_with(request, kind, workspace, ops, {})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "intake_issue_type_id" in response.data
        assert Project.objects.get(pk=ops.id).intake_view is False
        assert not Intake.objects.filter(project=ops).exists()

    @pytest.mark.parametrize("kind", ["app", "v1", "features"])
    def test_an_unlinked_intake_type_is_rejected(self, request, kind, workspace, ops):
        other = IssueType.objects.create(workspace=workspace, name="Elsewhere")

        response = enable_with(request, kind, workspace, ops, {"intake_issue_type_id": str(other.id)})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert Project.objects.get(pk=ops.id).intake_view is False

    @pytest.mark.parametrize("kind", ["app", "v1", "features"])
    def test_turning_intake_on_uses_the_chosen_type(self, request, kind, workspace, ops):
        bug = IssueType.objects.create(workspace=workspace, name="Bug")
        ProjectIssueType.objects.create(project=ops, issue_type=bug, workspace=workspace)

        response = enable_with(request, kind, workspace, ops, {"intake_issue_type_id": str(bug.id)})

        assert response.status_code == status.HTTP_200_OK, response.data
        assert Project.objects.get(pk=ops.id).intake_view is True
        assert Intake.objects.get(project=ops).issue_type_id == bug.id

    def test_an_intake_that_is_on_needs_no_type_again(self, request, workspace, project, intake, ticket):
        response = enable_with(request, "app", workspace, project, {"name": "Support desk"})

        assert response.status_code == status.HTTP_200_OK, response.data
        assert Intake.objects.get(project=project).issue_type_id == ticket.id


@pytest.mark.contract
@pytest.mark.django_db
class TestReenablingIntake:
    @pytest.fixture
    def turned_off(self, workspace, project, intake, ticket):
        Project.objects.filter(pk=project.id).update(intake_view=False)
        return project

    @pytest.mark.parametrize("kind", ["app", "v1", "features"])
    def test_the_intake_keeps_its_type(self, request, kind, workspace, turned_off, ticket):
        response = enable_with(request, kind, workspace, turned_off, {})

        assert response.status_code == status.HTTP_200_OK, response.data
        assert Project.objects.get(pk=turned_off.id).intake_view is True
        assert Intake.objects.get(project=turned_off).issue_type_id == ticket.id

    def test_a_given_type_replaces_it(self, request, workspace, turned_off):
        task = link_starter_type(turned_off)

        response = enable_with(request, "app", workspace, turned_off, {"intake_issue_type_id": str(task.id)})

        assert response.status_code == status.HTTP_200_OK, response.data
        assert Intake.objects.get(project=turned_off).issue_type_id == task.id
