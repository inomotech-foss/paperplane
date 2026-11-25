# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Page approvals over API v1: agents may submit, read and schedule, never decide."""

import uuid

import pytest
from rest_framework import status

from plane.db.models import (
    Page,
    PageApproval,
    PageApprovalEvent,
    PageApprover,
    Project,
    ProjectMember,
    ProjectPage,
    User,
    WorkspaceMember,
)
from plane.db.models.api import APIToken
from plane.tests.openapi import documented

pytestmark = [pytest.mark.contract, pytest.mark.django_db]

ADMIN, MEMBER = 20, 15


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="ISMS", identifier="ISMS", workspace=workspace, is_page_approval_enabled=True)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=ADMIN)
    return project


@pytest.fixture
def page(workspace, project, create_user):
    page = Page.objects.create(workspace=workspace, owned_by=create_user, name="Policy", description_html="<p>v1</p>")
    ProjectPage.objects.create(workspace=workspace, project=project, page=page)
    return page


@pytest.fixture
def approver(workspace, project):
    user = User.objects.create(email=f"{uuid.uuid4().hex[:8]}@plane.so", username=uuid.uuid4().hex[:8])
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=MEMBER)
    ProjectMember.objects.create(workspace=workspace, project=project, member=user, role=MEMBER)
    PageApprover.objects.create(workspace=workspace, project=project, member=user)
    return user


def page_url(workspace, project, page, action=""):
    base = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/pages/{page.id}/approval/"
    return f"{base}{action}/" if action else base


def test_an_agent_submits_a_page_for_review(api_key_client, workspace, project, page, create_user):
    response = api_key_client.post(page_url(workspace, project, page, "submit"), {"comment": "via MCP"}, format="json")

    data = documented(response, surface="v1")
    assert data["status"] == "in_review"
    event = PageApprovalEvent.objects.get(page=page)
    assert (event.action, event.actor, event.comment) == ("submitted", create_user, "via MCP")
    # the agent sees the state, not what a person in the app may do
    assert "can_decide" not in data


@pytest.mark.parametrize("decision", ["approve", "reject"])
def test_api_v1_has_no_decision(api_key_client, workspace, project, page, decision):
    api_key_client.post(page_url(workspace, project, page, "submit"), {}, format="json")

    response = api_key_client.post(page_url(workspace, project, page, decision), {"comment": "ok"}, format="json")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert PageApproval.objects.get(page=page).status == "in_review"


def test_an_approvers_api_key_cannot_approve_in_the_app_either(api_client, workspace, project, page, approver):
    """The same key, sent to the app's approve endpoint, is not a session."""
    token = APIToken.objects.create(user=approver, label="agent", token="approver-v1-key")
    api_client.credentials(HTTP_X_API_KEY=token.token)
    PageApproval.objects.create(page=page, project=project, workspace=workspace, status="in_review")

    response = api_client.post(
        f"/api/workspaces/{workspace.slug}/projects/{project.id}/pages/{page.id}/approval/approve/", {}, format="json"
    )

    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
    assert PageApproval.objects.get(page=page).status == "in_review"


def test_status_and_events(api_key_client, workspace, project, page):
    api_key_client.post(page_url(workspace, project, page, "submit"), {}, format="json")

    data = documented(api_key_client.get(page_url(workspace, project, page)), surface="v1")
    events = documented(api_key_client.get(page_url(workspace, project, page, "events")), surface="v1")

    assert (data["status"], data["enabled"], data["has_unapproved_changes"]) == ("in_review", True, True)
    assert [event["action"] for event in events["results"]] == ["submitted"]


def test_an_admin_agent_schedules_a_review(api_key_client, workspace, project, page):
    response = api_key_client.post(
        page_url(workspace, project, page, "review-date"), {"next_review_date": "2027-06-30"}, format="json"
    )

    assert documented(response, surface="v1")["next_review_date"] == "2027-06-30"
    assert PageApprovalEvent.objects.get(page=page).action == "review_date_set"


def test_the_register(api_key_client, workspace, project, page):
    response = api_key_client.get(f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/page-approvals/")

    data = documented(response, surface="v1")
    [row] = data["results"]
    assert (row["page"], row["name"], row["status"], row["is_review_overdue"]) == (
        str(page.id),
        "Policy",
        "draft",
        False,
    )


def test_the_feature_is_off_by_default_and_can_be_switched_on(api_key_client, workspace, create_user):
    project = Project.objects.create(name="Eng", identifier="ENG", workspace=workspace)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=ADMIN)
    path = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/features/"

    before = api_key_client.get(path).json()
    after = api_key_client.patch(path, {"page_approvals": True}, format="json")

    assert before["page_approvals"] is False
    assert after.status_code == status.HTTP_200_OK
    assert after.json()["page_approvals"] is True


def test_a_project_without_approvals_refuses_submission(api_key_client, workspace, create_user):
    project = Project.objects.create(name="Eng", identifier="ENG", workspace=workspace)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=ADMIN)
    page = Page.objects.create(workspace=workspace, owned_by=create_user, name="Notes")
    ProjectPage.objects.create(workspace=workspace, project=project, page=page)

    response = api_key_client.post(page_url(workspace, project, page, "submit"), {}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error_code"] == "APPROVALS_DISABLED"
    assert not PageApproval.objects.exists()
