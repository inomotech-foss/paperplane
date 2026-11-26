# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Page approval payloads, shared by the app API and API v1."""

from django.db.models import BooleanField, Case, F, Q, Value, When
from django.utils import timezone
from rest_framework import serializers

from plane.db.models import Page, PageApproval, PageApprovalEvent, PageApprover
from plane.utils import page_approval

STATUS_CHOICES = PageApproval.STATUS_CHOICES
IN_FORCE_KIND_CHOICES = (
    (PageApproval.IN_FORCE_APPROVED, "Approved in Paperplane"),
    (PageApproval.IN_FORCE_BASELINE, "Baseline (migrated, not reviewed in Paperplane)"),
)


class BaselineFieldsMixin(serializers.Serializer):
    """The baseline of a page and the approval it recorded before, shared by the status and the register."""

    in_force_kind = serializers.ChoiceField(
        choices=IN_FORCE_KIND_CHOICES,
        allow_null=True,
        help_text="What the version in force rests on: approved (reviewed in Paperplane), baseline (put in force "
        "without review when approvals were switched on) or null",
    )
    in_force_version = serializers.UUIDField(
        allow_null=True, help_text="Page version in force: the approved version, else the baseline"
    )
    in_force_label = serializers.CharField(help_text="in_force_kind in words, e.g. 'Approved, Rev 2'")
    status_label = serializers.CharField(help_text="status in words; a baseline is never called approved")
    baseline_version = serializers.UUIDField(
        allow_null=True, help_text="Page version put in force without review; superseded by the first approval"
    )
    baselined_by = serializers.UUIDField(allow_null=True, help_text="Who ran the baseline. Not an approver")
    baselined_at = serializers.DateTimeField(allow_null=True)
    legacy_status = serializers.CharField(
        allow_blank=True, help_text="Document status the page recorded before (e.g. Confluence), as written"
    )
    legacy_approved_by = serializers.CharField(
        allow_blank=True, help_text="Approver named in the page before, as written. Not a Paperplane user"
    )
    legacy_approved_at = serializers.DateField(allow_null=True, help_text="legacy_approved_at_raw, when readable")
    legacy_approved_at_raw = serializers.CharField(allow_blank=True, help_text="Approval date as written")
    legacy_note = serializers.CharField(
        allow_blank=True,
        help_text="The carried-over approval in words, for baselined pages; empty for pages never baselined",
    )


def baseline_data(approval):
    """The BaselineFieldsMixin values of an approval row (or None), less status_label."""
    kind = approval.in_force_kind if approval else None
    return {
        "in_force_kind": kind,
        "in_force_version": approval.in_force_version_id if approval else None,
        "in_force_label": page_approval.in_force_label(kind, approval.revision if approval else 0),
        "baseline_version": approval.baseline_version_id if approval else None,
        "baselined_by": approval.baselined_by_id if approval else None,
        "baselined_at": approval.baselined_at if approval else None,
        "legacy_status": approval.legacy_status if approval else "",
        "legacy_approved_by": approval.legacy_approved_by if approval else "",
        "legacy_approved_at": approval.legacy_approved_at if approval else None,
        "legacy_approved_at_raw": approval.legacy_approved_at_raw if approval else "",
        "legacy_note": page_approval.approval_legacy_note(approval),
    }


class PageApprovalStatusSerializer(BaselineFieldsMixin, serializers.Serializer):
    """Where a page stands in review, and which version is in force."""

    page = serializers.UUIDField()
    enabled = serializers.BooleanField(help_text="Whether the page's project has page approvals switched on")
    status = serializers.ChoiceField(choices=STATUS_CHOICES)
    revision = serializers.IntegerField(
        help_text="Number of approvals so far; an approved version in force is this revision. 0 for a baseline"
    )
    approved_version = serializers.UUIDField(
        allow_null=True, help_text="Approved page version; null for a baseline (see in_force_version)"
    )
    approved_by = serializers.UUIDField(allow_null=True)
    approved_at = serializers.DateTimeField(allow_null=True)
    approval_comment = serializers.CharField(allow_blank=True)
    submitted_version = serializers.UUIDField(allow_null=True, help_text="Page version submitted for review")
    submitted_by = serializers.UUIDField(allow_null=True)
    submitted_at = serializers.DateTimeField(allow_null=True)
    rejection_comment = serializers.CharField(allow_blank=True, help_text="Why the latest submission was rejected")
    next_review_date = serializers.DateField(allow_null=True)
    is_review_overdue = serializers.BooleanField()
    has_unapproved_changes = serializers.BooleanField(
        help_text="The page body differs from the version in force (approved or baseline), or nothing is in force"
    )


class PageApprovalStatusWithAbilitiesSerializer(PageApprovalStatusSerializer):
    can_decide = serializers.BooleanField(help_text="The current user may approve or reject the version under review")
    decision_blocked_reason = serializers.CharField(
        allow_null=True, help_text="Why the current user may not decide, when the page is in review"
    )
    can_schedule_review = serializers.BooleanField()
    is_approver = serializers.BooleanField()


def status_payload(page, project_id, request=None):
    """The status of a page; with a request, also what that user may do."""
    enabled = page_approval.approvals_enabled(project_id)
    approval = (
        PageApproval.objects.select_related("approved_version", "submitted_version", "baseline_version")
        .filter(page_id=page.id)
        .first()
    )
    rejection_comment = ""
    if approval is not None and approval.status == PageApproval.REJECTED:
        latest = (
            PageApprovalEvent.objects.filter(page_id=page.id, action=PageApprovalEvent.REJECTED)
            .order_by("-created_at")
            .first()
        )
        rejection_comment = latest.comment if latest else ""
    current_status = approval.status if approval else PageApproval.DRAFT
    data = {
        "page": page.id,
        "enabled": enabled,
        "status": current_status,
        "status_label": page_approval.STATUS_LABELS[current_status],
        "revision": approval.revision if approval else 0,
        "approved_version": approval.approved_version_id if approval else None,
        "approved_by": approval.approved_by_id if approval else None,
        "approved_at": approval.approved_at if approval else None,
        "approval_comment": approval.approval_comment if approval else "",
        "submitted_version": approval.submitted_version_id if approval else None,
        "submitted_by": approval.submitted_by_id if approval else None,
        "submitted_at": approval.submitted_at if approval else None,
        "rejection_comment": rejection_comment,
        "next_review_date": approval.next_review_date if approval else None,
        "is_review_overdue": page_approval.is_review_overdue(approval),
        "has_unapproved_changes": page_approval.has_unapproved_changes(page, approval),
        **baseline_data(approval),
    }
    if request is None:
        return PageApprovalStatusSerializer(data).data

    user_id = request.user.id
    is_approver = enabled and page_approval.is_approver(user_id, project_id)
    reason = None
    if approval is not None and approval.status == PageApproval.IN_REVIEW:
        refusal = page_approval.decision_refusal(request.user, page, approval, project_id)
        if refusal is None and not page_approval.is_human_session(request):
            refusal = page_approval.ApprovalError("HUMAN_SESSION_REQUIRED", "")
        reason = refusal.code if refusal else None
    data.update(
        {
            "can_decide": enabled and approval is not None and approval.status == PageApproval.IN_REVIEW and not reason,
            "decision_blocked_reason": reason,
            "can_schedule_review": enabled and (is_approver or page_approval.is_project_admin(user_id, project_id)),
            "is_approver": is_approver,
        }
    )
    return PageApprovalStatusWithAbilitiesSerializer(data).data


class PageApprovalEventSerializer(serializers.ModelSerializer):
    legacy_note = serializers.SerializerMethodField(
        help_text="For a baselined event, the approval the page recorded before, in words; otherwise empty"
    )

    class Meta:
        model = PageApprovalEvent
        fields = [
            "id",
            "page",
            "version",
            "action",
            "actor",
            "comment",
            "revision",
            "next_review_date",
            "legacy_status",
            "legacy_approved_by",
            "legacy_approved_at",
            "legacy_approved_at_raw",
            "legacy_note",
            "created_at",
        ]
        read_only_fields = fields

    def get_legacy_note(self, event) -> str:
        if event.action != PageApprovalEvent.BASELINED:
            return ""
        return page_approval.legacy_note(
            event.legacy_status, event.legacy_approved_by, event.legacy_approved_at, event.legacy_approved_at_raw
        )


class PageApprovalSubmitSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, default="", max_length=5000)


class PageApprovalApproveSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, default="", max_length=5000)
    next_review_date = serializers.DateField(
        required=False, allow_null=True, default=None, help_text="Defaults to a year from now"
    )


class PageApprovalRejectSerializer(serializers.Serializer):
    comment = serializers.CharField(max_length=5000, help_text="Why the version is rejected")


class PageApprovalReviewDateSerializer(serializers.Serializer):
    next_review_date = serializers.DateField(allow_null=True, help_text="null clears the date")
    comment = serializers.CharField(required=False, allow_blank=True, default="", max_length=5000)


class PageApprovalRegisterRowSerializer(BaselineFieldsMixin, serializers.Serializer):
    """One page in the project's document register."""

    page = serializers.UUIDField()
    name = serializers.CharField(allow_blank=True)
    owned_by = serializers.UUIDField()
    status = serializers.ChoiceField(choices=STATUS_CHOICES)
    revision = serializers.IntegerField()
    approved_version = serializers.UUIDField(allow_null=True)
    approved_by = serializers.UUIDField(allow_null=True)
    approved_at = serializers.DateTimeField(allow_null=True)
    submitted_at = serializers.DateTimeField(allow_null=True)
    next_review_date = serializers.DateField(allow_null=True)
    is_review_overdue = serializers.BooleanField()
    has_unapproved_changes = serializers.BooleanField()


REGISTER_FIELDS = (
    "id",
    "name",
    "owned_by_id",
    "approval__status",
    "approval__revision",
    "approval__approved_version_id",
    "approval__approved_by_id",
    "approval__approved_at",
    "approval__submitted_at",
    "approval__next_review_date",
    "approval__baseline_version_id",
    "approval__baselined_by_id",
    "approval__baselined_at",
    "approval__legacy_status",
    "approval__legacy_approved_by",
    "approval__legacy_approved_at",
    "approval__legacy_approved_at_raw",
    "unapproved",
)


def register_queryset(slug, project_id, user):
    """The project's live pages the user can see, with their approval columns."""
    return (
        Page.objects.filter(
            workspace__slug=slug,
            project_pages__project_id=project_id,
            project_pages__deleted_at__isnull=True,
            archived_at__isnull=True,
        )
        .filter(Q(access=Page.PUBLIC_ACCESS) | Q(owned_by=user))
        .annotate(
            # compared with the version in force: the approved one, else the baseline
            unapproved=Case(
                When(
                    approval__approved_version__isnull=False,
                    description_html=F("approval__approved_version__description_html"),
                    then=Value(False),
                ),
                When(
                    approval__approved_version__isnull=True,
                    approval__baseline_version__isnull=False,
                    description_html=F("approval__baseline_version__description_html"),
                    then=Value(False),
                ),
                default=Value(True),
                output_field=BooleanField(),
            )
        )
        .order_by("name", "id")
        .values(*REGISTER_FIELDS)
        .distinct()
    )


def _register_approval(row):
    """An unsaved PageApproval carrying the register row's columns, for the shared helpers."""
    if row["approval__status"] is None:
        return None
    return PageApproval(
        status=row["approval__status"],
        revision=row["approval__revision"] or 0,
        approved_version_id=row["approval__approved_version_id"],
        baseline_version_id=row["approval__baseline_version_id"],
        baselined_by_id=row["approval__baselined_by_id"],
        baselined_at=row["approval__baselined_at"],
        legacy_status=row["approval__legacy_status"] or "",
        legacy_approved_by=row["approval__legacy_approved_by"] or "",
        legacy_approved_at=row["approval__legacy_approved_at"],
        legacy_approved_at_raw=row["approval__legacy_approved_at_raw"] or "",
    )


def register_rows(rows):
    today = timezone.now().date()
    return [
        {
            "page": row["id"],
            "name": row["name"],
            "owned_by": row["owned_by_id"],
            "status": row["approval__status"] or PageApproval.DRAFT,
            "status_label": page_approval.STATUS_LABELS[row["approval__status"] or PageApproval.DRAFT],
            **baseline_data(_register_approval(row)),
            "revision": row["approval__revision"] or 0,
            "approved_version": row["approval__approved_version_id"],
            "approved_by": row["approval__approved_by_id"],
            "approved_at": row["approval__approved_at"],
            "submitted_at": row["approval__submitted_at"],
            "next_review_date": row["approval__next_review_date"],
            "is_review_overdue": bool(row["approval__next_review_date"] and row["approval__next_review_date"] < today),
            "has_unapproved_changes": row["unapproved"],
        }
        for row in rows
    ]


class PageApproverSerializer(serializers.ModelSerializer):
    class Meta:
        model = PageApprover
        fields = ["id", "member", "created_at"]
        read_only_fields = fields


class PageApproversUpdateSerializer(serializers.Serializer):
    member_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=True,
        help_text="The full list of approvers; replaces the current one",
    )
