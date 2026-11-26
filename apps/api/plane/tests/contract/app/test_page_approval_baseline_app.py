# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Baselines: content put in force without review, shown as such, and replaced by the first approval."""

from datetime import date

import pytest
from rest_framework import status

from plane.bgtasks.page_version_task import PAGE_VERSION_RETENTION_LIMIT
from plane.db.models import (
    Page,
    PageApproval,
    PageApprovalEvent,
    PageApprover,
    PageVersion,
    Project,
    ProjectMember,
    ProjectPage,
)
from plane.importers.confluence.document_status import LegacyApproval
from plane.tests.openapi import documented
from plane.utils import page_approval
from plane.utils.page_approval import ApprovalError

from .test_page_approvals_app import (
    ADMIN,
    MEMBER,
    add_member,
    approve,
    client_for,
    edit,
    make_user,
    reject,
    submit,
    url,
)

pytestmark = [pytest.mark.contract, pytest.mark.django_db]

ROGER = LegacyApproval(
    status="approved", approved_by="Roger Knecht", approved_at=date(2025, 11, 3), approved_at_raw="03.11.2025"
)
BASELINE_LABEL = "Baseline (migrated, not reviewed in Paperplane)"


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="ISMS", identifier="ISMS", workspace=workspace, is_page_approval_enabled=True)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=ADMIN)
    return project


@pytest.fixture
def plain_project(workspace, create_user):
    project = Project.objects.create(name="Engineering", identifier="ENG", workspace=workspace)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=ADMIN)
    return project


@pytest.fixture
def admin(create_user):
    """The project admin who runs the baseline command."""
    return create_user


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


def baseline(of_page, in_project, actor, legacy=ROGER, **kwargs):
    return page_approval.baseline(of_page, in_project.id, actor, legacy=legacy, **kwargs)


# --- the baseline itself ------------------------------------------------------


def test_a_baseline_puts_the_current_content_in_force_without_approving_it(workspace, project, page, author, admin):
    baseline(page, project, admin)

    data = documented(client_for(author).get(url(workspace, project, page)))

    approval = PageApproval.objects.get(page=page)
    snapshot = approval.baseline_version
    assert snapshot.description_html == "<p>v1</p>"
    assert data["status"] == "baseline"
    assert data["status_label"] == BASELINE_LABEL
    assert data["in_force_kind"] == "baseline"
    assert data["in_force_version"] == str(snapshot.id)
    assert data["in_force_label"] == BASELINE_LABEL
    # nothing about it is an approval
    assert data["approved_version"] is None
    assert data["approved_by"] is None
    assert data["approved_at"] is None
    assert data["revision"] == 0
    assert data["baselined_by"] == str(admin.id)
    assert data["has_unapproved_changes"] is False
    assert data["next_review_date"] is None


def test_the_confluence_approval_is_carried_over_as_text(workspace, project, page, author, admin):
    baseline(page, project, admin)

    data = documented(client_for(author).get(url(workspace, project, page)))

    assert data["legacy_status"] == "approved"
    assert data["legacy_approved_by"] == "Roger Knecht"
    assert data["legacy_approved_at"] == "2025-11-03"
    assert data["legacy_approved_at_raw"] == "03.11.2025"
    assert data["legacy_note"] == "Carried over from Confluence: approved by Roger Knecht, 03.11.2025"


def test_a_page_without_a_recorded_approval(workspace, project, page, author, admin):
    baseline(page, project, admin, legacy=None)

    data = documented(client_for(author).get(url(workspace, project, page)))

    assert data["legacy_status"] == ""
    assert data["legacy_note"] == "Baseline, no prior approval recorded"


def test_the_baseline_is_logged_as_its_own_event(workspace, project, page, author, admin):
    baseline(page, project, admin, next_review_date=date(2027, 3, 31), comment="Migrated from Confluence")

    events = documented(client_for(author).get(url(workspace, project, page, "events")))

    [event] = events
    snapshot = PageApproval.objects.get(page=page).baseline_version
    assert event["action"] == "baselined"
    assert event["actor"] == str(admin.id)
    assert event["version"] == str(snapshot.id)
    assert event["revision"] is None
    assert event["next_review_date"] == "2027-03-31"
    assert event["comment"] == "Migrated from Confluence"
    assert (event["legacy_status"], event["legacy_approved_by"]) == ("approved", "Roger Knecht")
    assert (event["legacy_approved_at"], event["legacy_approved_at_raw"]) == ("2025-11-03", "03.11.2025")
    assert event["legacy_note"] == "Carried over from Confluence: approved by Roger Knecht, 03.11.2025"
    assert not PageApprovalEvent.objects.filter(page=page, action=PageApprovalEvent.APPROVED).exists()


def test_a_baseline_sets_the_review_date_only_when_given(workspace, project, page, admin, approver):
    page_approval.set_review_date(page, project.id, approver, date(2027, 1, 31))

    baseline(page, project, admin)

    assert PageApproval.objects.get(page=page).next_review_date == date(2027, 1, 31)


def test_only_a_pristine_draft_can_be_baselined(workspace, project, page, author, approver, admin):
    submit(client_for(author), workspace, project, page)

    with pytest.raises(ApprovalError) as refused:
        baseline(page, project, admin)

    assert refused.value.code == "NOT_A_PRISTINE_DRAFT"
    assert page_approval.baseline_refusal(page) == "status in_review"
    approve(client_for(approver), workspace, project, page)
    assert page_approval.baseline_refusal(page) == "already approved"


def test_a_page_is_baselined_once(workspace, project, page, admin):
    baseline(page, project, admin)

    assert page_approval.baseline_refusal(page) == "already baselined"
    with pytest.raises(ApprovalError):
        baseline(page, project, admin)
    assert PageApprovalEvent.objects.filter(page=page).count() == 1


def test_a_rejected_draft_is_not_pristine(workspace, project, page, author, approver):
    submit(client_for(author), workspace, project, page)
    reject(client_for(approver), workspace, project, page)

    assert page_approval.baseline_refusal(page) == "status rejected"


def test_archived_pages_are_not_baselined(workspace, project, page):
    Page.objects.filter(pk=page.pk).update(archived_at=date.today())
    page.refresh_from_db()

    assert page_approval.baseline_refusal(page) == "archived"


def test_no_baseline_without_approvals(workspace, plain_project, create_user):
    notes = Page.objects.create(workspace=workspace, owned_by=create_user, name="Notes", description_html="<p>x</p>")
    ProjectPage.objects.create(workspace=workspace, project=plain_project, page=notes)

    with pytest.raises(ApprovalError) as refused:
        page_approval.baseline(notes, plain_project.id, create_user)

    assert refused.value.code == "APPROVALS_DISABLED"


# --- readers and editors --------------------------------------------------------


def test_edits_show_as_unapproved_changes_on_top_of_the_baseline(workspace, project, page, author, admin):
    baseline(page, project, admin)
    snapshot = PageApproval.objects.get(page=page).baseline_version

    edit(page, author, "<p>v2</p>")
    data = client_for(author).get(url(workspace, project, page)).json()

    assert data["has_unapproved_changes"] is True
    assert data["status"] == "baseline"
    # readers still get the baseline
    assert data["in_force_version"] == str(snapshot.id)
    snapshot.refresh_from_db()
    assert snapshot.description_html == "<p>v1</p>"


def test_the_baseline_version_is_frozen(workspace, project, page, admin):
    # the admin who runs the baseline edits right after: no coalescing into the snapshot
    baseline(page, project, admin)
    snapshot = PageApproval.objects.get(page=page).baseline_version

    edit(page, admin, "<p>v2</p>")

    snapshot.refresh_from_db()
    assert snapshot.description_html == "<p>v1</p>"
    assert snapshot.id in page_approval.frozen_version_ids(page.id)
    for number in range(PAGE_VERSION_RETENTION_LIMIT + 2):
        edit(page, make_user(), f"<p>v{number + 3}</p>")
    assert PageVersion.objects.filter(pk=snapshot.pk).exists()


# --- the review cycle afterwards ------------------------------------------------


def test_baseline_edit_submit_approve(workspace, project, page, author, approver, admin):
    baseline(page, project, admin)
    baseline_version = PageApproval.objects.get(page=page).baseline_version
    edit(page, author, "<p>v2</p>")

    documented(submit(client_for(author), workspace, project, page))
    in_review = client_for(author).get(url(workspace, project, page)).json()
    assert (in_review["status"], in_review["in_force_kind"]) == ("in_review", "baseline")

    data = documented(approve(client_for(approver), workspace, project, page))

    approval = PageApproval.objects.get(page=page)
    assert data["status"] == "approved"
    assert data["status_label"] == "Approved"
    assert data["in_force_kind"] == "approved"
    assert data["in_force_label"] == "Approved, Rev 1"
    assert data["in_force_version"] == data["approved_version"] == str(approval.approved_version_id)
    assert approval.approved_version.description_html == "<p>v2</p>"
    assert data["approved_by"] == str(approver.id)
    assert data["revision"] == 1
    assert data["has_unapproved_changes"] is False
    # the baseline stays on record, superseded
    assert data["baseline_version"] == str(baseline_version.id)
    actions = list(PageApprovalEvent.objects.filter(page=page).order_by("created_at").values_list("action", flat=True))
    assert actions == ["baselined", "submitted", "approved"]


def test_an_unchanged_baseline_can_be_submitted_for_its_first_review(workspace, project, page, author, approver, admin):
    baseline(page, project, admin)

    response = submit(client_for(author), workspace, project, page)

    assert response.status_code == status.HTTP_200_OK
    assert approve(client_for(approver), workspace, project, page).json()["in_force_kind"] == "approved"


def test_a_rejection_keeps_the_baseline_in_force(workspace, project, page, author, approver, admin):
    baseline(page, project, admin)
    snapshot = PageApproval.objects.get(page=page).baseline_version
    edit(page, author, "<p>v2</p>")
    submit(client_for(author), workspace, project, page)

    data = documented(reject(client_for(approver), workspace, project, page, comment="Section 3 is wrong"))

    assert data["status"] == "rejected"
    assert data["in_force_kind"] == "baseline"
    assert data["in_force_version"] == str(snapshot.id)
    assert data["approved_version"] is None
    assert data["rejection_comment"] == "Section 3 is wrong"
    # and it can go round again
    assert submit(client_for(author), workspace, project, page).status_code == status.HTTP_200_OK


def test_running_the_baseline_is_not_editing(workspace, project, page, author, admin):
    """The snapshot is a record, not an edit: an admin who baselined may still approve."""
    PageApprover.objects.create(workspace=workspace, project=project, member=admin)
    baseline(page, project, admin)
    submit(client_for(author), workspace, project, page)

    response = approve(client_for(admin), workspace, project, page)

    assert response.status_code == status.HTTP_200_OK, response.json()


# --- the register ---------------------------------------------------------------


def test_the_register_labels_baselines(workspace, project, page, author, approver, admin):
    other = Page.objects.create(workspace=workspace, owned_by=author, name="Backup policy", description_html="<p>b</p>")
    ProjectPage.objects.create(workspace=workspace, project=project, page=other)
    baseline(page, project, admin)
    baseline(other, project, admin, legacy=None)
    edit(other, author, "<p>b2</p>")

    rows = documented(client_for(author).get(f"/api/workspaces/{workspace.slug}/projects/{project.id}/page-approvals/"))

    by_name = {row["name"]: row for row in rows}
    policy, backup = by_name["Information security policy"], by_name["Backup policy"]
    assert (policy["status"], policy["status_label"]) == ("baseline", BASELINE_LABEL)
    assert policy["in_force_kind"] == "baseline"
    assert policy["approved_by"] is None and policy["revision"] == 0
    assert policy["legacy_note"] == "Carried over from Confluence: approved by Roger Knecht, 03.11.2025"
    assert policy["has_unapproved_changes"] is False
    assert backup["legacy_note"] == "Baseline, no prior approval recorded"
    assert backup["has_unapproved_changes"] is True


def test_no_api_route_baselines_a_page(workspace, project, page, admin, api_key_client):
    """Baselining is admin maintenance through the management command only."""
    for path in ("baseline", "baselined"):
        response = client_for(admin).post(url(workspace, project, page, path), {}, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND
        v1 = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/pages/{page.id}/approval/{path}/"
        assert api_key_client.post(v1, {}, format="json").status_code == status.HTTP_404_NOT_FOUND
    assert not PageApproval.objects.filter(page=page).exists()
