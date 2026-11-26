# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Baselining existing pages from the app: the preview, and the queued run."""

from datetime import date
from unittest.mock import patch

import pytest
from rest_framework import status

from plane.bgtasks.page_baseline_task import baseline_pages
from plane.db.models import Page, PageApproval, PageApprovalEvent, PageVersion, Project, ProjectMember, ProjectPage
from plane.tests.openapi import documented
from plane.utils import page_approval

from .test_page_approvals_app import ADMIN, GUEST, MEMBER, add_member, client_for, make_user

pytestmark = [pytest.mark.contract, pytest.mark.django_db]

STATUS_TABLE = (
    '<h1 class="auto-cursor-target">Document status</h1><table class="wrapped"><tbody>'
    '<tr><th>Status</th><td><div class="content-wrapper"><span data-background-color="green">approved</span></div></td>'
    '<td colspan="1"><span data-background-color="gray">draft</span></td></tr>'
    "<tr><th>Approved on</th><td>03.11.2025</td><td><br></td></tr>"
    "<tr><th>Approved by</th><td>Roger Knecht</td><td><br></td></tr></tbody></table><p>Policy text</p>"
)
AUTO_TABLE = STATUS_TABLE.replace(">approved<", ">AUTO<").replace("03.11.2025", "").replace("Roger Knecht", "")
ROGER_NOTE = "Carried over from Confluence: approved by Roger Knecht, 03.11.2025"
NO_PRIOR = "Baseline, no prior approval recorded"
DELAY = "plane.app.views.page.approval.baseline_pages.delay"


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="ISMS", identifier="ISMS", workspace=workspace, is_page_approval_enabled=True)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=ADMIN)
    return project


@pytest.fixture
def admin(create_user):
    return create_user


@pytest.fixture
def make_page(workspace, project, admin):
    def make(name, html="<p>text</p>", in_project=None, **extra):
        page = Page.objects.create(name=name, workspace=workspace, owned_by=admin, **extra)
        ProjectPage.objects.create(workspace=workspace, project=in_project or project, page=page)
        Page.objects.filter(pk=page.pk).update(description_html=html)
        page.refresh_from_db()
        return page

    return make


def path(workspace, project):
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/page-approvals/baseline/"


def run_now(**kwargs):
    """Stand-in for .delay: run the task in the request."""
    return baseline_pages(**kwargs)


# --- who may ---------------------------------------------------------------------


def test_members_and_guests_may_not_baseline(workspace, project, make_page):
    make_page("Policy")
    member = add_member(workspace, project, make_user(), MEMBER)
    guest = add_member(workspace, project, make_user(), GUEST)

    for user in (member, guest):
        client = client_for(user)
        with patch(DELAY) as delay:
            assert client.get(path(workspace, project)).status_code == status.HTTP_403_FORBIDDEN
            assert client.post(path(workspace, project), {}, format="json").status_code == status.HTTP_403_FORBIDDEN
        delay.assert_not_called()
    assert not PageApproval.objects.exists()


def test_a_project_without_approvals_refuses(workspace, admin):
    plain = Project.objects.create(name="Engineering", identifier="ENG", workspace=workspace)
    ProjectMember.objects.create(workspace=workspace, project=plain, member=admin, role=ADMIN)
    client = client_for(admin)

    with patch(DELAY) as delay:
        responses = (client.get(path(workspace, plain)), client.post(path(workspace, plain), {}, format="json"))

    for response in responses:
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.json()["error_code"] == "APPROVALS_DISABLED"
    delay.assert_not_called()


# --- the preview -------------------------------------------------------------------


def test_the_preview_lists_every_page_and_writes_nothing(workspace, project, make_page, admin):
    make_page("Access control policy", STATUS_TABLE)
    make_page("Statement of Applicability", AUTO_TABLE)
    make_page("Meeting notes")
    make_page("Locked", is_locked=True)
    make_page("Old", archived_at=date(2025, 1, 1))
    reviewed = make_page("Reviewed")
    page_approval.submit(reviewed, project.id, admin)
    versions = PageVersion.objects.count()

    data = documented(client_for(admin).get(path(workspace, project)))

    rows = {row["name"]: row for row in data["pages"]}
    assert rows["Access control policy"]["skip_reason"] is None
    assert rows["Access control policy"]["legacy_kind"] == "approved"
    assert rows["Access control policy"]["legacy_note"] == ROGER_NOTE
    assert rows["Statement of Applicability"]["legacy_kind"] == "other"
    assert rows["Statement of Applicability"]["legacy_note"] == (
        "Carried over from Confluence: status AUTO; not recorded as approved"
    )
    assert (rows["Meeting notes"]["legacy_kind"], rows["Meeting notes"]["legacy_note"]) == ("none", NO_PRIOR)
    assert rows["Locked"]["skip_reason"] == "locked"
    assert rows["Locked"]["legacy_note"] == NO_PRIOR
    assert (rows["Old"]["skip_reason"], rows["Old"]["legacy_note"]) == ("archived", "")
    assert (rows["Reviewed"]["skip_reason"], rows["Reviewed"]["skip_reason_label"]) == ("in_review", "in review")
    assert data["totals"] == {
        "pages": 6,
        "eligible": 3,
        "locked": 1,
        "skipped": 2,
        "legacy_approved": 1,
        "legacy_other": 1,
        "legacy_none": 1,
    }
    assert PageApproval.objects.count() == 1
    assert PageApprovalEvent.objects.count() == 1
    assert PageVersion.objects.count() == versions


def test_the_preview_marks_baselined_pages(workspace, project, make_page, admin):
    page = make_page("Policy")
    page_approval.baseline(page, project.id, admin)

    data = documented(client_for(admin).get(path(workspace, project)))

    [row] = data["pages"]
    assert (row["skip_reason"], row["legacy_kind"]) == ("already_baselined", None)


# --- the run ----------------------------------------------------------------------


def test_baselines_eligible_pages_and_skips_the_rest(workspace, project, make_page, admin):
    policy = make_page("Access control policy", STATUS_TABLE)
    notes = make_page("Meeting notes")
    locked = make_page("Locked", is_locked=True)
    archived = make_page("Old", archived_at=date(2025, 1, 1))

    with patch(DELAY, side_effect=run_now):
        data = documented(
            client_for(admin).post(path(workspace, project), {"comment": "Migrated"}, format="json"),
            status=status.HTTP_202_ACCEPTED,
        )

    assert data == {"queued": 2, "skipped": 2}
    approvals = {approval.page_id: approval for approval in PageApproval.objects.all()}
    assert set(approvals) == {policy.id, notes.id}
    for approval in approvals.values():
        assert approval.status == "baseline"
        assert approval.baselined_by == admin
        assert approval.approved_by_id is None
        assert approval.revision == 0
        assert approval.next_review_date is None
    roger = approvals[policy.id]
    assert (roger.legacy_status, roger.legacy_approved_by, roger.legacy_approved_at) == (
        "approved",
        "Roger Knecht",
        date(2025, 11, 3),
    )
    assert roger.baseline_version.description_html == STATUS_TABLE
    events = PageApprovalEvent.objects.filter(action="baselined")
    assert {(event.actor_id, event.comment) for event in events} == {(admin.id, "Migrated")}
    assert not PageApproval.objects.filter(page__in=[locked, archived]).exists()


def test_a_second_run_changes_nothing(workspace, project, make_page, admin):
    make_page("Policy")
    client = client_for(admin)
    with patch(DELAY, side_effect=run_now):
        client.post(path(workspace, project), {}, format="json")

    with patch(DELAY) as delay:
        data = documented(client.post(path(workspace, project), {}, format="json"), status=status.HTTP_202_ACCEPTED)

    assert data == {"queued": 0, "skipped": 1}
    delay.assert_not_called()
    assert PageApprovalEvent.objects.count() == 1


def test_locked_pages_with_include_locked_and_a_review_date(workspace, project, make_page, admin):
    locked = make_page("Locked", is_locked=True)

    with patch(DELAY, side_effect=run_now):
        documented(
            client_for(admin).post(
                path(workspace, project), {"include_locked": True, "next_review_date": "2027-03-31"}, format="json"
            ),
            status=status.HTTP_202_ACCEPTED,
        )

    approval = PageApproval.objects.get(page=locked)
    assert approval.status == "baseline"
    assert approval.next_review_date == date(2027, 3, 31)
    assert PageApprovalEvent.objects.get(page=locked).next_review_date == date(2027, 3, 31)


def test_limits_the_run_to_given_pages(workspace, project, make_page, admin):
    one = make_page("One")
    two = make_page("Two")

    with patch(DELAY, side_effect=run_now) as delay:
        data = documented(
            client_for(admin).post(path(workspace, project), {"page_ids": [str(one.id)]}, format="json"),
            status=status.HTTP_202_ACCEPTED,
        )

    assert data == {"queued": 1, "skipped": 0}
    assert delay.call_args.kwargs["page_ids"] == [str(one.id)]
    assert delay.call_args.kwargs["actor_id"] == str(admin.id)
    assert PageApproval.objects.filter(page=one).exists()
    assert not PageApproval.objects.filter(page=two).exists()


def test_refuses_pages_of_other_projects(workspace, project, make_page, admin):
    other = Project.objects.create(name="Engineering", identifier="ENG", workspace=workspace)
    stray = make_page("Elsewhere", in_project=other)

    with patch(DELAY) as delay:
        response = client_for(admin).post(path(workspace, project), {"page_ids": [str(stray.id)]}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["page_ids"] == [str(stray.id)]
    delay.assert_not_called()


def test_refuses_a_review_date_in_the_past(workspace, project, make_page, admin):
    make_page("Policy")

    with patch(DELAY) as delay:
        response = client_for(admin).post(path(workspace, project), {"next_review_date": "2020-01-01"}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["next_review_date"] == ["The next review date cannot be in the past"]
    delay.assert_not_called()
    assert not PageApproval.objects.exists()


def test_other_users_private_pages_are_out_of_reach(workspace, project, make_page, admin):
    author = add_member(workspace, project, make_user(), MEMBER)
    secret = Page.objects.create(
        name="Private notes",
        workspace=workspace,
        owned_by=author,
        access=Page.PRIVATE_ACCESS,
        description_html="<p>x</p>",
    )
    ProjectPage.objects.create(workspace=workspace, project=project, page=secret)
    make_page("Policy")
    client = client_for(admin)

    preview = documented(client.get(path(workspace, project)))
    with patch(DELAY) as delay:
        response = client.post(path(workspace, project), {"page_ids": [str(secret.id)]}, format="json")

    assert [row["name"] for row in preview["pages"]] == ["Policy"]
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["page_ids"] == [str(secret.id)]
    delay.assert_not_called()


def test_the_preview_queries_do_not_grow_with_the_pages(
    workspace, project, make_page, admin, django_assert_max_num_queries
):
    for number in range(30):
        make_page(f"Page {number}", STATUS_TABLE)
    client = client_for(admin)

    with django_assert_max_num_queries(25):
        data = documented(client.get(path(workspace, project)))

    assert data["totals"]["eligible"] == 30


def test_baselined_pages_go_through_review_normally(workspace, project, make_page, admin):
    page = make_page("Policy", STATUS_TABLE)
    with patch(DELAY, side_effect=run_now):
        client_for(admin).post(path(workspace, project), {}, format="json")

    page_approval.submit(page, project.id, admin)

    approval = PageApproval.objects.get(page=page)
    assert (approval.status, approval.in_force_kind) == ("in_review", "baseline")
