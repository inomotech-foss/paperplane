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

Baseline: a page can also be put in force without a review, once, when
approvals are switched on for an existing wiki. Only project admins do it, in
the app's approval settings (a project-level endpoint, run as a background
task); API v1 and MCP offer no way to baseline. The baseline is a version
in force like an approved one (readers see it, edits show as unapproved
changes, it is frozen), but its status is "baseline", it names no approver
and its revision is 0. It accepts submit (with or without changes), and the
first approval replaces it:

    draft ──baseline (admin)──▶ baseline ──submit──▶ in_review ──approve──▶ approved
                                                          │
                                                        reject──▶ rejected (baseline stays in force)
"""

from datetime import date, timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status

from plane.importers.confluence.document_status import APPROVED_STATUSES, parse_document_status
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
    queryset = PageApproval.all_objects.select_related("approved_version", "submitted_version", "baseline_version")
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
    """The page body differs from the version in force (approved or baseline), or nothing is in force."""
    in_force = approval.in_force_version if approval is not None else None
    if in_force is None:
        return True
    return (page.description_html or "") != (in_force.description_html or "")


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


def baseline_refusal(page):
    """Why the page cannot be baselined, as a short reason, or None.

    Only a pristine draft can: no approval row, or one that never had a
    submission, decision or baseline. A scheduled review date alone does not
    count. Reads only, so a dry run can ask.
    """
    if page.archived_at:
        return "archived"
    approval = PageApproval.all_objects.filter(page_id=page.id).first()
    if approval is not None:
        if approval.baseline_version_id:
            return "already baselined"
        if approval.approved_version_id:
            return "already approved"
        if approval.status != PageApproval.DRAFT:
            return f"status {approval.status}"
        if approval.submitted_version_id:
            return "already submitted"
    history = (
        PageApprovalEvent.all_objects.filter(page_id=page.id)
        .exclude(action=PageApprovalEvent.REVIEW_DATE_SET)
        .values_list("action", flat=True)
        .first()
    )
    if history:
        return f"has approval history ({history})"
    return None


LOCKED = "locked"


def baseline_skip_reason(page, include_locked=False):
    """baseline_refusal, plus LOCKED for a locked page unless include_locked."""
    reason = baseline_refusal(page)
    if reason is None and page.is_locked and not include_locked:
        return LOCKED
    return reason


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


def _log(approval, action, user, *, version=None, comment="", revision=None, next_review_date=None, legacy=None):
    legacy_fields = {}
    if legacy is not None:
        legacy_fields = {
            "legacy_status": legacy.status,
            "legacy_approved_by": legacy.approved_by,
            "legacy_approved_at": legacy.approved_at,
            "legacy_approved_at_raw": legacy.approved_at_raw,
        }
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
        **legacy_fields,
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
        # A baseline may be submitted unchanged: reviewing it is how it becomes approved.
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


def baseline(page, project_id, user, *, legacy=None, next_review_date=None, comment=""):
    """Put the page's current content in force without a review. Project admins only.

    Snapshots the body as submit does and records it as baseline_version,
    with a "baselined" event naming the person who ran it. Nobody is recorded
    as approver and the revision stays 0. `legacy` (a LegacyApproval) is the
    approval the page itself recorded before, stored as text for information.
    next_review_date, when given, replaces the scheduled review; otherwise the
    page keeps whatever it had (usually nothing).
    """
    require_enabled(project_id)
    with transaction.atomic():
        page = _locked_page(page.id)
        reason = baseline_refusal(page)
        if reason:
            raise ApprovalError("NOT_A_PRISTINE_DRAFT", f"The page cannot be baselined: {reason}")
        approval = approval_for(page, project_id, for_update=True)
        version = _snapshot(page, user)
        approval.status = PageApproval.BASELINE
        approval.baseline_version = version
        approval.baselined_by_id = user.id
        approval.baselined_at = timezone.now()
        approval.legacy_status = legacy.status if legacy else ""
        approval.legacy_approved_by = legacy.approved_by if legacy else ""
        approval.legacy_approved_at = legacy.approved_at if legacy else None
        approval.legacy_approved_at_raw = legacy.approved_at_raw if legacy else ""
        if next_review_date is not None:
            approval.next_review_date = next_review_date
        approval.save(
            update_fields=[
                "status",
                "baseline_version",
                "baselined_by",
                "baselined_at",
                "legacy_status",
                "legacy_approved_by",
                "legacy_approved_at",
                "legacy_approved_at_raw",
                "next_review_date",
                "updated_at",
            ]
        )
        _log(
            approval,
            PageApprovalEvent.BASELINED,
            user,
            version=version,
            comment=comment,
            next_review_date=approval.next_review_date,
            legacy=legacy,
        )
    return approval


# --- labels -------------------------------------------------------------------
# The API returns these next to the codes, so every reader (the app, API v1,
# MCP) says the same thing, and a baseline is never called an approval.

STATUS_LABELS = dict(PageApproval.STATUS_CHOICES)
NO_PRIOR_APPROVAL = "Baseline, no prior approval recorded"


def legacy_note(status_text, approved_by, approved_at, approved_at_raw):
    """One sentence on the approval a page recorded before it was baselined."""
    when = approved_at_raw or (approved_at.strftime("%d.%m.%Y") if approved_at else "")
    if not (status_text or approved_by or when):
        return NO_PRIOR_APPROVAL
    if status_text.strip().lower() in APPROVED_STATUSES:
        words = "approved"
        if approved_by:
            words += f" by {approved_by}"
        if when:
            words += f", {when}"
        if not approved_by:
            words += " (approver not recorded)" if when else " (approver and date not recorded)"
        return f"Carried over from Confluence: {words}"
    parts = [f"status {status_text}" if status_text else "no status"]
    if approved_by:
        parts.append(f"approved by {approved_by}")
    if when:
        parts.append(f"dated {when}")
    return f"Carried over from Confluence: {', '.join(parts)}; not recorded as approved"


def page_legacy(page):
    """The approval the page recorded itself (a Confluence "Document status" table), or None."""
    return parse_document_status(page.description_html)


def legacy_note_of(legacy):
    """legacy_note for a LegacyApproval or None."""
    if legacy is None:
        return NO_PRIOR_APPROVAL
    return legacy_note(legacy.status, legacy.approved_by, legacy.approved_at, legacy.approved_at_raw)


def approval_legacy_note(approval):
    """The legacy note of a baselined page, or "" for a page that was never baselined."""
    if approval is None or not approval.baseline_version_id:
        return ""
    return legacy_note(
        approval.legacy_status,
        approval.legacy_approved_by,
        approval.legacy_approved_at,
        approval.legacy_approved_at_raw,
    )


def in_force_label(kind, revision):
    """What the version in force rests on, in words."""
    if kind == PageApproval.IN_FORCE_APPROVED:
        return f"Approved, Rev {revision}"
    if kind == PageApproval.IN_FORCE_BASELINE:
        return STATUS_LABELS[PageApproval.BASELINE]
    return "Nothing in force"
