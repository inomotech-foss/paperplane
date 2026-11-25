# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Page approvals in the app: the review cycle, who may decide, and projects that leave it off."""

import json
import uuid
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from plane.bgtasks.page_version_task import PAGE_VERSION_RETENTION_LIMIT, track_page_version
from plane.db.models import (
    Page,
    PageApproval,
    PageApprovalEvent,
    PageApprover,
    PageVersion,
    Project,
    ProjectMember,
    ProjectPage,
    User,
    WorkspaceMember,
)
from plane.db.models.api import APIToken
from plane.tests.openapi import documented

pytestmark = [pytest.mark.contract, pytest.mark.django_db]

ADMIN, MEMBER, GUEST = 20, 15, 5


def make_user(**fields):
    return User.objects.create(email=f"{uuid.uuid4().hex[:8]}@plane.so", username=uuid.uuid4().hex[:8], **fields)


def client_for(user, token=None):
    client = APIClient()
    client.force_authenticate(user=user, token=token)
    return client


def add_member(workspace, project, user, role):
    WorkspaceMember.objects.get_or_create(workspace=workspace, member=user, defaults={"role": role})
    ProjectMember.objects.create(workspace=workspace, project=project, member=user, role=role)
    return user


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="ISMS", identifier="ISMS", workspace=workspace, is_page_approval_enabled=True)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=ADMIN)
    return project


@pytest.fixture
def author(workspace, project):
    return add_member(workspace, project, make_user(), MEMBER)


@pytest.fixture
def approver(workspace, project):
    user = add_member(workspace, project, make_user(), MEMBER)
    PageApprover.objects.create(workspace=workspace, project=project, member=user)
    return user


@pytest.fixture
def page(workspace, project, author):
    page = Page.objects.create(
        workspace=workspace, owned_by=author, name="Information security policy", description_html="<p>v1</p>"
    )
    ProjectPage.objects.create(workspace=workspace, project=project, page=page)
    return page


def url(workspace, project, page, action=""):
    base = f"/api/workspaces/{workspace.slug}/projects/{project.id}/pages/{page.id}/approval/"
    return f"{base}{action}/" if action else base


def submit(client, workspace, project, page, comment="ready"):
    return client.post(url(workspace, project, page, "submit"), {"comment": comment}, format="json")


def approve(client, workspace, project, page, **body):
    return client.post(url(workspace, project, page, "approve"), body, format="json")


def reject(client, workspace, project, page, comment="needs work"):
    return client.post(url(workspace, project, page, "reject"), {"comment": comment}, format="json")


def edit(page, user, html):
    """An editor save: the body changes and version tracking records who saved it."""
    old = page.description_html
    page.description_html = html
    page.save()
    track_page_version(page_id=str(page.id), existing_instance=json.dumps({"description_html": old}), user_id=user.id)


# --- the review cycle -------------------------------------------------------


def test_new_page_is_a_draft_with_nothing_in_force(workspace, project, page, author):
    data = documented(client_for(author).get(url(workspace, project, page)))

    assert data["enabled"] is True
    assert data["status"] == "draft"
    assert data["approved_version"] is None
    assert data["has_unapproved_changes"] is True
    assert data["can_decide"] is False


def test_submit_snapshots_the_page_for_review(workspace, project, page, author):
    data = documented(submit(client_for(author), workspace, project, page))

    approval = PageApproval.objects.get(page=page)
    snapshot = approval.submitted_version
    assert data["status"] == "in_review"
    assert data["submitted_version"] == str(snapshot.id)
    assert snapshot.description_html == "<p>v1</p>"
    assert snapshot.owned_by == author
    [event] = PageApprovalEvent.objects.filter(page=page)
    assert (event.action, event.actor, event.version, event.comment) == ("submitted", author, snapshot, "ready")


def test_approval_puts_the_submitted_snapshot_in_force(workspace, project, page, author, approver):
    submit(client_for(author), workspace, project, page)
    snapshot = PageApproval.objects.get(page=page).submitted_version

    data = documented(approve(client_for(approver), workspace, project, page, comment="Looks right"))

    assert data["status"] == "approved"
    assert data["revision"] == 1
    assert data["approved_version"] == str(snapshot.id)
    assert data["approved_by"] == str(approver.id)
    assert data["approval_comment"] == "Looks right"
    assert data["has_unapproved_changes"] is False
    # without a date, the next review is due in a year
    assert data["next_review_date"] == str((timezone.now() + timedelta(days=365)).date())
    event = PageApprovalEvent.objects.filter(page=page, action="approved").get()
    assert (event.actor, event.version, event.revision) == (approver, snapshot, 1)


def test_edits_during_review_stay_unapproved(workspace, project, page, author, approver):
    submit(client_for(author), workspace, project, page)
    edit(page, author, "<p>v2</p>")

    data = documented(approve(client_for(approver), workspace, project, page))

    assert PageApproval.objects.get(page=page).approved_version.description_html == "<p>v1</p>"
    assert data["has_unapproved_changes"] is True


def test_a_given_review_date_is_kept(workspace, project, page, author, approver):
    submit(client_for(author), workspace, project, page)

    data = documented(approve(client_for(approver), workspace, project, page, next_review_date="2027-03-01"))

    assert data["next_review_date"] == "2027-03-01"


def test_rejection_needs_a_reason_and_keeps_the_version_in_force(workspace, project, page, author, approver):
    submit(client_for(author), workspace, project, page)
    approve(client_for(approver), workspace, project, page)
    in_force = PageApproval.objects.get(page=page).approved_version
    edit(page, author, "<p>v2</p>")
    submit(client_for(author), workspace, project, page)

    no_reason = client_for(approver).post(url(workspace, project, page, "reject"), {"comment": " "}, format="json")
    data = documented(reject(client_for(approver), workspace, project, page, "Scope section missing"))

    assert no_reason.status_code == status.HTTP_400_BAD_REQUEST
    assert data["status"] == "rejected"
    assert data["rejection_comment"] == "Scope section missing"
    assert data["approved_version"] == str(in_force.id)
    assert data["revision"] == 1


def test_resubmitting_after_a_rejection(workspace, project, page, author, approver):
    submit(client_for(author), workspace, project, page)
    reject(client_for(approver), workspace, project, page)
    edit(page, author, "<p>v1, fixed</p>")

    assert documented(submit(client_for(author), workspace, project, page))["status"] == "in_review"
    assert documented(approve(client_for(approver), workspace, project, page))["revision"] == 1


def test_an_approved_page_without_changes_cannot_be_submitted(workspace, project, page, author, approver):
    submit(client_for(author), workspace, project, page)
    approve(client_for(approver), workspace, project, page)

    response = submit(client_for(author), workspace, project, page)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error_code"] == "NOTHING_TO_REVIEW"


def test_approving_needs_a_pending_review(workspace, project, page, approver):
    response = approve(client_for(approver), workspace, project, page)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error_code"] == "NOT_IN_REVIEW"


def test_guests_cannot_submit(workspace, project, page):
    guest = add_member(workspace, project, make_user(), GUEST)
    Project.objects.filter(pk=project.pk).update(guest_view_all_features=True)

    assert submit(client_for(guest), workspace, project, page).status_code == status.HTTP_403_FORBIDDEN


# --- who may decide -----------------------------------------------------------


def test_only_configured_approvers_decide(workspace, project, page, author, create_user):
    submit(client_for(author), workspace, project, page)
    other = add_member(workspace, project, make_user(), MEMBER)

    for user in (other, create_user):  # a plain member, and a project admin who is not an approver
        response = approve(client_for(user), workspace, project, page)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert response.json()["error_code"] == "NOT_AN_APPROVER"
    assert PageApproval.objects.get(page=page).status == "in_review"


def test_an_approver_who_left_the_project_cannot_decide(workspace, project, page, author, approver):
    submit(client_for(author), workspace, project, page)
    ProjectMember.objects.filter(project=project, member=approver).update(is_active=False)

    response = approve(client_for(approver), workspace, project, page)

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_the_submitter_cannot_approve_their_own_submission(workspace, project, page, approver):
    submit(client_for(approver), workspace, project, page)

    response = approve(client_for(approver), workspace, project, page)
    rejection = reject(client_for(approver), workspace, project, page)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["error_code"] == "SEGREGATION_OF_DUTIES"
    assert rejection.status_code == status.HTTP_403_FORBIDDEN
    assert PageApproval.objects.get(page=page).status == "in_review"


def test_an_approver_who_edited_the_page_cannot_approve_it(workspace, project, page, author, approver):
    edit(page, approver, "<p>v1 with the approver's change</p>")
    submit(client_for(author), workspace, project, page)

    response = approve(client_for(approver), workspace, project, page)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["error_code"] == "SEGREGATION_OF_DUTIES"
    status_data = documented(client_for(approver).get(url(workspace, project, page)))
    assert (status_data["can_decide"], status_data["decision_blocked_reason"]) == (False, "SEGREGATION_OF_DUTIES")


def test_edits_before_the_last_approval_do_not_block(workspace, project, page, author, approver):
    second = add_member(workspace, project, make_user(), MEMBER)
    PageApprover.objects.create(workspace=workspace, project=project, member=second)
    edit(page, approver, "<p>first draft by the approver</p>")
    submit(client_for(author), workspace, project, page)
    approve(client_for(second), workspace, project, page)
    edit(page, author, "<p>v2</p>")
    submit(client_for(author), workspace, project, page)

    assert documented(approve(client_for(approver), workspace, project, page))["revision"] == 2


def test_status_tells_an_eligible_approver_they_can_decide(workspace, project, page, author, approver):
    submit(client_for(author), workspace, project, page)

    data = documented(client_for(approver).get(url(workspace, project, page)))

    assert (data["can_decide"], data["decision_blocked_reason"], data["is_approver"]) == (True, None, True)


# --- approvals need a person -------------------------------------------------------


def test_an_api_key_cannot_reach_the_app_decision_endpoints(workspace, project, page, author, approver):
    submit(client_for(author), workspace, project, page)
    token = APIToken.objects.create(user=approver, label="agent", token="approver-api-key-123")
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=token.token)

    approved = approve(client, workspace, project, page)
    rejected = reject(client, workspace, project, page)

    assert approved.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
    assert rejected.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
    assert PageApproval.objects.get(page=page).status == "in_review"


def test_a_token_authenticated_request_cannot_decide(workspace, project, page, author, approver):
    """Even if a token-based authenticator reached these views, the decision refuses it."""
    submit(client_for(author), workspace, project, page)
    token = APIToken.objects.create(user=approver, label="agent", token="approver-api-key-456")

    response = approve(client_for(approver, token=token), workspace, project, page)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["error_code"] == "HUMAN_SESSION_REQUIRED"
    assert PageApproval.objects.get(page=page).status == "in_review"


def test_a_bot_cannot_decide(workspace, project, page, author):
    bot = add_member(workspace, project, make_user(is_bot=True), MEMBER)
    PageApprover.objects.create(workspace=workspace, project=project, member=bot)
    submit(client_for(author), workspace, project, page)

    response = approve(client_for(bot), workspace, project, page)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["error_code"] == "HUMAN_SESSION_REQUIRED"


# --- review dates -------------------------------------------------------------------


def test_approvers_and_admins_schedule_reviews(workspace, project, page, author, approver, create_user):
    for user, day in ((approver, "2027-01-15"), (create_user, "2027-02-15")):
        response = client_for(user).post(
            url(workspace, project, page, "review-date"), {"next_review_date": day}, format="json"
        )
        assert documented(response)["next_review_date"] == day

    refused = client_for(author).post(
        url(workspace, project, page, "review-date"), {"next_review_date": "2030-01-01"}, format="json"
    )
    assert refused.status_code == status.HTTP_403_FORBIDDEN
    assert PageApprovalEvent.objects.filter(page=page, action="review_date_set").count() == 2


def test_a_past_review_date_is_overdue(workspace, project, page, approver):
    yesterday = str(timezone.now().date() - timedelta(days=1))
    client_for(approver).post(
        url(workspace, project, page, "review-date"), {"next_review_date": yesterday}, format="json"
    )

    assert documented(client_for(approver).get(url(workspace, project, page)))["is_review_overdue"] is True


# --- the log and its versions --------------------------------------------------------


def test_the_event_log_lists_the_cycle_newest_first(workspace, project, page, author, approver):
    submit(client_for(author), workspace, project, page)
    approve(client_for(approver), workspace, project, page)

    data = documented(client_for(author).get(url(workspace, project, page, "events")))

    assert [event["action"] for event in data] == ["approved", "submitted"]


def test_events_are_append_only(workspace, project, page, author):
    submit(client_for(author), workspace, project, page)
    event = PageApprovalEvent.objects.get(page=page)

    event.comment = "rewritten"
    with pytest.raises(ValueError):
        event.save()
    with pytest.raises(ValueError):
        event.delete()


def test_later_edits_never_go_into_an_approval_snapshot(workspace, project, page, author):
    submit(client_for(author), workspace, project, page)
    snapshot = PageApproval.objects.get(page=page).submitted_version

    # the same user editing right away would normally coalesce into their latest version
    edit(page, author, "<p>v2</p>")

    snapshot.refresh_from_db()
    assert snapshot.description_html == "<p>v1</p>"
    assert PageVersion.objects.filter(page=page).count() == 2


def test_retention_never_prunes_an_approval_snapshot(workspace, project, page, author, approver):
    submit(client_for(author), workspace, project, page)
    approve(client_for(approver), workspace, project, page)
    snapshot = PageApproval.objects.get(page=page).approved_version
    PageVersion.objects.filter(pk=snapshot.pk).update(last_saved_at=timezone.now() - timedelta(days=999))

    for number in range(PAGE_VERSION_RETENTION_LIMIT + 2):
        # different authors, so nothing coalesces
        edit(page, add_member(workspace, project, make_user(), MEMBER), f"<p>edit {number}</p>")

    assert PageVersion.objects.filter(pk=snapshot.pk).exists()
    assert PageVersion.objects.filter(page=page).exclude(pk=snapshot.pk).count() == PAGE_VERSION_RETENTION_LIMIT


# --- register and approvers ------------------------------------------------------------


def register_url(workspace, project):
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/page-approvals/"


def test_register_lists_every_page_with_its_state(workspace, project, page, author, approver):
    other = Page.objects.create(workspace=workspace, owned_by=author, name="Asset inventory")
    ProjectPage.objects.create(workspace=workspace, project=project, page=other)
    hidden = Page.objects.create(workspace=workspace, owned_by=approver, name="Private notes", access=1)
    ProjectPage.objects.create(workspace=workspace, project=project, page=hidden)
    submit(client_for(author), workspace, project, page)
    approve(client_for(approver), workspace, project, page, next_review_date="2020-01-01")

    rows = documented(client_for(author).get(register_url(workspace, project)))

    assert [row["name"] for row in rows] == ["Asset inventory", "Information security policy"]
    unapproved, approved = rows
    assert (unapproved["status"], unapproved["revision"], unapproved["has_unapproved_changes"]) == ("draft", 0, True)
    assert approved["status"] == "approved"
    assert approved["approved_by"] == str(approver.id)
    assert (approved["has_unapproved_changes"], approved["is_review_overdue"]) == (False, True)


def test_approver_list_is_maintained_by_admins(workspace, project, author, approver, create_user):
    path = f"/api/workspaces/{workspace.slug}/projects/{project.id}/page-approvers/"

    refused = client_for(author).put(path, {"member_ids": [str(author.id)]}, format="json")
    data = documented(client_for(create_user).put(path, {"member_ids": [str(author.id)]}, format="json"))

    assert refused.status_code == status.HTTP_403_FORBIDDEN
    assert [row["member"] for row in data] == [str(author.id)]
    assert not PageApprover.objects.filter(project=project, member=approver).exists()
    assert [row["member"] for row in documented(client_for(author).get(path))] == [str(author.id)]


def test_approvers_must_be_project_members(workspace, project, create_user):
    path = f"/api/workspaces/{workspace.slug}/projects/{project.id}/page-approvers/"
    guest = add_member(workspace, project, make_user(), GUEST)
    outsider = make_user()

    for user in (guest, outsider):
        response = client_for(create_user).put(path, {"member_ids": [str(user.id)]}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert not PageApprover.objects.filter(project=project).exists()


# --- projects that leave it off ------------------------------------------------------------


@pytest.fixture
def plain_project(workspace, create_user):
    project = Project.objects.create(name="Engineering", identifier="ENG", workspace=workspace)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=ADMIN)
    return project


def test_approvals_are_off_by_default(plain_project):
    assert plain_project.is_page_approval_enabled is False


def test_a_project_without_approvals_refuses_every_approval_action(workspace, plain_project, create_user):
    page = Page.objects.create(workspace=workspace, owned_by=create_user, name="Notes", description_html="<p>x</p>")
    ProjectPage.objects.create(workspace=workspace, project=plain_project, page=page)
    client = client_for(create_user)

    data = documented(client.get(url(workspace, plain_project, page)))
    submitted = submit(client, workspace, plain_project, page)
    register = client.get(register_url(workspace, plain_project))

    assert (data["enabled"], data["status"], data["can_decide"], data["can_schedule_review"]) == (
        False,
        "draft",
        False,
        False,
    )
    for response in (submitted, register):
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.json()["error_code"] == "APPROVALS_DISABLED"
    assert not PageApproval.objects.exists()
    assert not PageApprovalEvent.objects.exists()


def test_editing_in_a_project_without_approvals_versions_as_before(workspace, plain_project, create_user):
    page = Page.objects.create(workspace=workspace, owned_by=create_user, name="Notes", description_html="<p>a</p>")
    ProjectPage.objects.create(workspace=workspace, project=plain_project, page=page)

    edit(page, create_user, "<p>b</p>")
    edit(page, create_user, "<p>c</p>")

    # consecutive edits by one user still coalesce into one version
    [version] = PageVersion.objects.filter(page=page)
    assert version.description_html == "<p>c</p>"


def test_the_project_feature_toggle_round_trips(workspace, plain_project, create_user):
    path = f"/api/workspaces/{workspace.slug}/projects/{plain_project.id}/"

    response = client_for(create_user).patch(path, {"is_page_approval_enabled": True}, format="json")

    assert response.status_code == status.HTTP_200_OK, response.content
    plain_project.refresh_from_db()
    assert plain_project.is_page_approval_enabled is True
