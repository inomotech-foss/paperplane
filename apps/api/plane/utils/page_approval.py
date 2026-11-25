# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Page review and approval: the rules, in one place for the app API and API v1.

Approvals are opt-in per project (Project.is_page_approval_enabled). The
state machine of a page's latest review:

    draft ──submit──▶ in_review ──approve──▶ approved
      ▲                 │  ▲                   │
      │               reject└──submit──┐       │ submit (after edits)
      │                 ▼              │       ▼
      └──────────── rejected ──submit──┴─▶ in_review

Submitting snapshots the page body as a PageVersion. Approving puts exactly
that snapshot in force, so the approver approves what was submitted even if
the draft moved on meanwhile; those later edits show as unapproved changes.

Who may do what:
- submit: anyone who may edit the page, through the app or API v1 (API key,
  OAuth, MCP).
- approve / reject: a configured approver who is an active project member,
  in a human session (session cookie, no token, not a bot), and who neither
  submitted the version nor edited the page since the last approval.
- review date: an approver or a project admin, through either API.
"""

from datetime import date, timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status

from plane.db.models import (
    Page,
    PageApproval,
    PageApprovalEvent,
    PageApprover,
    PageVersion,
    Project,
    ProjectMember,
    WorkspaceMember,
)

ADMIN_ROLE = 20

# Without an explicit date, an approval schedules the next review this far out
# (ISO 27001 7.5 / 9001 7.5: documents are reviewed periodically).
DEFAULT_REVIEW_INTERVAL = timedelta(days=365)


class ApprovalError(Exception):
    """A refused approval action, with the HTTP status and a stable code."""

    def __init__(self, code, message, http_status=status.HTTP_400_BAD_REQUEST):
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status

    def as_response_data(self):
        return {"error_code": self.code, "error": self.message}


def approvals_enabled(project_id):
    return Project.objects.filter(pk=project_id, is_page_approval_enabled=True).exists()


def require_enabled(project_id):
    if not approvals_enabled(project_id):
        raise ApprovalError("APPROVALS_DISABLED", "Page approvals are not enabled for this project")


def is_human_session(request):
    """True for a person signed in to the app, false for any token-based caller.

    Session authentication yields no auth token; API keys and OAuth bearer
    tokens do. Bots are refused whatever authenticated them.
    """
    user = request.user
    if user is None or user.is_anonymous or getattr(user, "is_bot", False):
        return False
    return request.auth is None


def is_approver(user_id, project_id):
    """A configured approver who is still an active member of the project."""
    return (
        PageApprover.objects.filter(project_id=project_id, member_id=user_id).exists()
        and ProjectMember.objects.filter(project_id=project_id, member_id=user_id, is_active=True).exists()
    )


def is_project_admin(user_id, project_id):
    """A project admin, or a workspace admin who is a member of the project (as allow_permission counts it)."""
    membership = ProjectMember.objects.filter(project_id=project_id, member_id=user_id, is_active=True).first()
    if membership is None:
        return False
    return (
        membership.role == ADMIN_ROLE
        or WorkspaceMember.objects.filter(
            workspace_id=membership.workspace_id, member_id=user_id, is_active=True, role=ADMIN_ROLE
        ).exists()
    )


def approval_for(page, project_id, *, for_update=False):
    """The page's approval row, created as a draft the first time it is needed."""
    queryset = PageApproval.all_objects.select_related("approved_version", "submitted_version")
    if for_update:
        queryset = queryset.select_for_update(of=("self",))
    approval = queryset.filter(page_id=page.id).first()
    if approval is None:
        try:
            with transaction.atomic():
                approval = PageApproval.objects.create(
                    page_id=page.id, project_id=project_id, workspace_id=page.workspace_id
                )
        except IntegrityError:
            # created concurrently
            approval = queryset.get(page_id=page.id)
    if approval.deleted_at is not None:
        # the page was deleted and restored; its approval history comes back with it
        approval.deleted_at = None
        approval.save(update_fields=["deleted_at"])
    return approval


def frozen_version_ids(page_id):
    """Versions an approval refers to. Version tracking must leave them as they are."""
    return set(
        PageApprovalEvent.all_objects.filter(page_id=page_id, version__isnull=False).values_list(
            "version_id", flat=True
        )
    )


def has_unapproved_changes(page, approval):
    if approval is None or approval.approved_version_id is None:
        return True
    return (page.description_html or "") != (approval.approved_version.description_html or "")


def is_review_overdue(approval, today=None):
    if approval is None or approval.next_review_date is None:
        return False
    return approval.next_review_date < (today or timezone.now().date())


def contributors(page, approval):
    """Who edited the page since the version in force was approved.

    Taken from version history, which records who saved each body change
    (editor, app API and API v1 alike), plus whoever submitted the version
    under review. Imported history and approval snapshots are not edits.
    """
    versions = PageVersion.objects.filter(page_id=page.id, external_source__isnull=True).exclude(
        id__in=frozen_version_ids(page.id)
    )
    if approval.approved_at is not None:
        versions = versions.filter(updated_at__gt=approval.approved_at)
    authors = set(versions.values_list("owned_by_id", flat=True))
    if approval.submitted_by_id:
        authors.add(approval.submitted_by_id)
    return authors


def decision_refusal(user, page, approval, project_id):
    """Why this user may not approve or reject the version under review, or None."""
    if approval.status != PageApproval.IN_REVIEW or approval.submitted_version_id is None:
        return ApprovalError("NOT_IN_REVIEW", "The page is not waiting for review")
    if not is_approver(user.id, project_id):
        return ApprovalError(
            "NOT_AN_APPROVER", "Only the project's page approvers can decide on a review", status.HTTP_403_FORBIDDEN
        )
    if user.id in contributors(page, approval):
        return ApprovalError(
            "SEGREGATION_OF_DUTIES",
            "You submitted or edited this version, so someone else has to review it",
            status.HTTP_403_FORBIDDEN,
        )
    return None


def _snapshot(page, user):
    """A frozen copy of the page body as it is now."""
    return PageVersion.objects.create(
        page_id=page.id,
        workspace_id=page.workspace_id,
        owned_by_id=user.id,
        last_saved_at=timezone.now(),
        description_html=page.description_html,
        description_binary=page.description_binary,
        description_json=page.description_json,
        sub_pages_data={},
    )


def _log(approval, action, user, *, version=None, comment="", revision=None, next_review_date=None):
    return PageApprovalEvent.objects.create(
        workspace_id=approval.workspace_id,
        project_id=approval.project_id,
        page_id=approval.page_id,
        version=version,
        action=action,
        actor_id=user.id,
        comment=comment or "",
        revision=revision,
        next_review_date=next_review_date,
    )


def _locked_page(page_id):
    return Page.objects.select_for_update().get(pk=page_id)


def submit(page, project_id, user, comment=""):
    require_enabled(project_id)
    with transaction.atomic():
        page = _locked_page(page.id)
        if page.archived_at:
            raise ApprovalError("PAGE_ARCHIVED", "An archived page cannot be submitted for review")
        approval = approval_for(page, project_id, for_update=True)
        if approval.status == PageApproval.APPROVED and not has_unapproved_changes(page, approval):
            raise ApprovalError("NOTHING_TO_REVIEW", "The page has no changes since it was approved")
        version = _snapshot(page, user)
        approval.status = PageApproval.IN_REVIEW
        approval.submitted_version = version
        approval.submitted_by_id = user.id
        approval.submitted_at = timezone.now()
        approval.save(update_fields=["status", "submitted_version", "submitted_by", "submitted_at", "updated_at"])
        _log(approval, PageApprovalEvent.SUBMITTED, user, version=version, comment=comment)
    return approval


def approve(request, page, project_id, comment="", next_review_date=None):
    require_enabled(project_id)
    user = request.user
    if not is_human_session(request):
        raise ApprovalError(
            "HUMAN_SESSION_REQUIRED", "Approvals need a person signed in to Paperplane", status.HTTP_403_FORBIDDEN
        )
    with transaction.atomic():
        page = _locked_page(page.id)
        approval = approval_for(page, project_id, for_update=True)
        refusal = decision_refusal(user, page, approval, project_id)
        if refusal:
            raise refusal
        now = timezone.now()
        if next_review_date is None:
            keep = approval.next_review_date and approval.next_review_date > now.date()
            next_review_date = approval.next_review_date if keep else (now + DEFAULT_REVIEW_INTERVAL).date()
        approval.status = PageApproval.APPROVED
        approval.approved_version_id = approval.submitted_version_id
        approval.approved_by_id = user.id
        approval.approved_at = now
        approval.approval_comment = comment or ""
        approval.revision += 1
        approval.next_review_date = next_review_date
        approval.save(
            update_fields=[
                "status",
                "approved_version",
                "approved_by",
                "approved_at",
                "approval_comment",
                "revision",
                "next_review_date",
                "updated_at",
            ]
        )
        _log(
            approval,
            PageApprovalEvent.APPROVED,
            user,
            version=approval.approved_version,
            comment=comment,
            revision=approval.revision,
            next_review_date=next_review_date,
        )
    return approval


def reject(request, page, project_id, comment):
    require_enabled(project_id)
    user = request.user
    if not is_human_session(request):
        raise ApprovalError(
            "HUMAN_SESSION_REQUIRED", "Approvals need a person signed in to Paperplane", status.HTTP_403_FORBIDDEN
        )
    if not (comment or "").strip():
        raise ApprovalError("COMMENT_REQUIRED", "Say why the version is rejected")
    with transaction.atomic():
        page = _locked_page(page.id)
        approval = approval_for(page, project_id, for_update=True)
        refusal = decision_refusal(user, page, approval, project_id)
        if refusal:
            raise refusal
        approval.status = PageApproval.REJECTED
        approval.save(update_fields=["status", "updated_at"])
        _log(approval, PageApprovalEvent.REJECTED, user, version=approval.submitted_version, comment=comment)
    return approval


def set_review_date(page, project_id, user, next_review_date, comment=""):
    require_enabled(project_id)
    if not (is_approver(user.id, project_id) or is_project_admin(user.id, project_id)):
        raise ApprovalError(
            "NOT_AN_APPROVER",
            "Only page approvers and project admins can schedule reviews",
            status.HTTP_403_FORBIDDEN,
        )
    if next_review_date is not None and not isinstance(next_review_date, date):
        raise ApprovalError("INVALID_DATE", "next_review_date must be a date")
    with transaction.atomic():
        page = _locked_page(page.id)
        approval = approval_for(page, project_id, for_update=True)
        approval.next_review_date = next_review_date
        approval.save(update_fields=["next_review_date", "updated_at"])
        _log(approval, PageApprovalEvent.REVIEW_DATE_SET, user, comment=comment, next_review_date=next_review_date)
    return approval
