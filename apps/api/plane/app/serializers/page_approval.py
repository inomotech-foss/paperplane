# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Page approval payloads, shared by the app API and API v1."""

from django.db.models import BooleanField, Case, F, Q, Value, When
from django.utils import timezone
from rest_framework import serializers

from plane.db.models import Page, PageApproval, PageApprovalEvent, PageApprover
from plane.utils import page_approval

STATUS_CHOICES = PageApproval.STATUS_CHOICES


class PageApprovalStatusSerializer(serializers.Serializer):
    """Where a page stands in review, and which version is in force."""

    page = serializers.UUIDField()
    enabled = serializers.BooleanField(help_text="Whether the page's project has page approvals switched on")
    status = serializers.ChoiceField(choices=STATUS_CHOICES)
    revision = serializers.IntegerField(help_text="Number of approvals so far; the version in force is this revision")
    approved_version = serializers.UUIDField(allow_null=True, help_text="Page version in force")
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
        help_text="The page body differs from the version in force, or nothing is approved yet"
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
        PageApproval.objects.select_related("approved_version", "submitted_version").filter(page_id=page.id).first()
    )
    rejection_comment = ""
    if approval is not None and approval.status == PageApproval.REJECTED:
        latest = (
            PageApprovalEvent.objects.filter(page_id=page.id, action=PageApprovalEvent.REJECTED)
            .order_by("-created_at")
            .first()
        )
        rejection_comment = latest.comment if latest else ""
    data = {
        "page": page.id,
        "enabled": enabled,
        "status": approval.status if approval else PageApproval.DRAFT,
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
    class Meta:
        model = PageApprovalEvent
        fields = ["id", "page", "version", "action", "actor", "comment", "revision", "next_review_date", "created_at"]
        read_only_fields = fields


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


class PageApprovalRegisterRowSerializer(serializers.Serializer):
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
            unapproved=Case(
                When(approval__approved_version__isnull=True, then=Value(True)),
                When(description_html=F("approval__approved_version__description_html"), then=Value(False)),
                default=Value(True),
                output_field=BooleanField(),
            )
        )
        .order_by("name", "id")
        .values(*REGISTER_FIELDS)
        .distinct()
    )


def register_rows(rows):
    today = timezone.now().date()
    return [
        {
            "page": row["id"],
            "name": row["name"],
            "owned_by": row["owned_by_id"],
            "status": row["approval__status"] or PageApproval.DRAFT,
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
