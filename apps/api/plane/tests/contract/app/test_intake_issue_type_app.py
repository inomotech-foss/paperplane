# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Work items that arrive through an intake get the type their submitter or the publish settings name."""

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
def intake(db, workspace, project):
    return Intake.objects.create(name="Intake", project=project, workspace=workspace, is_default=True)


def post_intake_item(request, kind, workspace, project, issue):
    """Send `issue` to the intake the way `kind` does. Returns the response and the success status."""
    if kind == "app":
        client, created = request.getfixturevalue("session_client"), 200
        url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/intake-issues/"
    else:
        client, created = request.getfixturevalue("api_key_client"), 201
        url = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/intake-issues/"
    return client.post(url, {"issue": issue}, format="json"), created


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.parametrize("kind", ["app", "v1"])
class TestSubmittersNameTheType:
    def test_the_named_type_is_used(self, request, kind, workspace, project, intake, ticket):
        issue = {"name": "Printer", "type_id": str(ticket.id)}
        response, created = post_intake_item(request, kind, workspace, project, issue)

        assert response.status_code == created, response.data
        assert Issue.objects.get(name="Printer").type_id == ticket.id

    def test_a_missing_type_is_rejected(self, request, kind, workspace, project, intake):
        response, _ = post_intake_item(request, kind, workspace, project, {"name": "Printer"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "type_id" in response.data
        assert not Issue.objects.filter(name="Printer").exists()

    def test_a_type_not_enabled_for_the_project_is_rejected(self, request, kind, workspace, project, intake):
        elsewhere = IssueType.objects.create(workspace=workspace, name="Elsewhere")

        issue = {"name": "Printer", "type_id": str(elsewhere.id)}
        response, _ = post_intake_item(request, kind, workspace, project, issue)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "type_id" in response.data
        assert not Issue.objects.filter(name="Printer").exists()


def publish_url(workspace, project, board=None):
    base = f"/api/workspaces/{workspace.slug}/projects/{project.id}/project-deploy-boards/"
    return f"{base}{board.id}/" if board else base


@pytest.mark.contract
@pytest.mark.django_db
class TestPublishedIntakeForm:
    def test_publishing_the_form_needs_a_type(self, session_client, workspace, project, intake):
        response = session_client.post(publish_url(workspace, project), {"intake": str(intake.id)}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "intake_issue_type" in response.data
        assert not DeployBoard.objects.filter(project=project).exists()

    def test_a_type_not_enabled_for_the_project_is_rejected(self, session_client, workspace, project, intake):
        elsewhere = IssueType.objects.create(workspace=workspace, name="Elsewhere")

        response = session_client.post(
            publish_url(workspace, project),
            {"intake": str(intake.id), "intake_issue_type": str(elsewhere.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "intake_issue_type" in response.data

    def test_an_intake_of_another_project_is_rejected(self, session_client, workspace, project, ticket, create_user):
        other = Project.objects.create(name="Other", identifier="OTH", workspace=workspace, created_by=create_user)
        foreign = Intake.objects.create(name="Other", project=other, workspace=workspace)

        response = session_client.post(
            publish_url(workspace, project),
            {"intake": str(foreign.id), "intake_issue_type": str(ticket.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "intake" in response.data

    def test_publishing_stores_the_type(self, session_client, workspace, project, intake, ticket):
        response = session_client.post(
            publish_url(workspace, project),
            {"intake": str(intake.id), "intake_issue_type": str(ticket.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK, response.data
        board = DeployBoard.objects.get(project=project)
        assert (board.intake_id, board.intake_issue_type_id) == (intake.id, ticket.id)

    def test_turning_the_form_on_later_needs_a_type(self, session_client, workspace, project, intake):
        board = DeployBoard.objects.create(entity_name="project", entity_identifier=project.id, project=project)

        response = session_client.patch(
            publish_url(workspace, project, board), {"intake": str(intake.id)}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "intake_issue_type" in response.data
        board.refresh_from_db()
        assert board.intake_id is None

    def test_turning_the_form_off_clears_the_type(self, session_client, workspace, project, intake, ticket):
        board = DeployBoard.objects.create(
            entity_name="project",
            entity_identifier=project.id,
            project=project,
            intake=intake,
            intake_issue_type=ticket,
        )

        response = session_client.patch(publish_url(workspace, project, board), {"intake": None}, format="json")

        assert response.status_code == status.HTTP_200_OK, response.data
        board.refresh_from_db()
        assert (board.intake_id, board.intake_issue_type_id) == (None, None)

    def test_submissions_get_the_type_of_the_form(self, session_client, workspace, project, intake, ticket):
        board = DeployBoard.objects.create(
            entity_name="project",
            entity_identifier=project.id,
            project=project,
            intake=intake,
            intake_issue_type=ticket,
        )

        response = session_client.post(
            f"/api/public/anchor/{board.anchor}/intakes/{intake.id}/intake-issues/",
            {"issue": {"name": "Printer", "type_id": str(link_starter_type(project).id)}},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK, response.data
        assert Issue.objects.get(name="Printer").type_id == ticket.id


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


def enable_intake(request, kind, workspace, project):
    """Turn intake on the way `kind` does."""
    if kind == "app":
        url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/"
        return request.getfixturevalue("session_client").patch(url, {"inbox_view": True}, format="json")
    if kind == "v1":
        url = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/"
        return request.getfixturevalue("api_key_client").patch(url, {"intake_view": True}, format="json")
    url = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/features/"
    return request.getfixturevalue("api_key_client").patch(url, {"intakes": True}, format="json")


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.parametrize("kind", ["app", "v1", "features"])
def test_turning_intake_on_is_a_plain_switch(request, kind, workspace, create_user):
    ops = Project.objects.create(name="Ops", identifier="OPS", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=ops, member=create_user, role=20, is_active=True)
    link_starter_type(ops)

    response = enable_intake(request, kind, workspace, ops)

    assert response.status_code == status.HTTP_200_OK, response.data
    assert Project.objects.get(pk=ops.id).intake_view is True
