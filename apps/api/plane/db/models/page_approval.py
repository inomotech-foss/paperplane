# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Review and approval of pages, for projects that switch on page approvals.

A page keeps one PageApproval row with the state of its latest review and the
version in force. Every submission, decision and review date is also written
to PageApprovalEvent, which is append-only: it is the audit trail.

Versions an approval points at are frozen. Version tracking neither coalesces
later edits into them nor prunes them (see page_version_task), and they are
RESTRICTed, so deleting one directly fails while deleting the page still
removes everything.

A baseline is not an approval. When approvals are switched on for an existing
wiki, an admin can mark a page's current content as the version in force
without anyone reviewing it (the baseline_page_approvals command). That
version is kept in baseline_version, never in approved_version, and nobody is
recorded as its approver. A Confluence approval found in the page is carried
over as text in the legacy_* fields, for information only. The first real
approval takes over: approved_version wins over baseline_version.
"""

from django.conf import settings
from django.db import models

from .base import BaseModel


class PageApproval(BaseModel):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    BASELINE = "baseline"
    STATUS_CHOICES = (
        (DRAFT, "Draft"),
        (IN_REVIEW, "In review"),
        (APPROVED, "Approved"),
        (REJECTED, "Rejected"),
        (BASELINE, "Baseline (migrated, not reviewed in Paperplane)"),
    )

    # What the version in force rests on
    IN_FORCE_APPROVED = "approved"
    IN_FORCE_BASELINE = "baseline"

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="page_approvals")
    project = models.ForeignKey("db.Project", on_delete=models.CASCADE, related_name="page_approvals")
    page = models.OneToOneField("db.Page", on_delete=models.CASCADE, related_name="approval")
    # The state of the latest review. The version in force is approved_version,
    # whatever the status: a page under review or rejected keeps it.
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=DRAFT)

    submitted_version = models.ForeignKey(
        "db.PageVersion", on_delete=models.RESTRICT, null=True, blank=True, related_name="+"
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    submitted_at = models.DateTimeField(null=True, blank=True)

    approved_version = models.ForeignKey(
        "db.PageVersion", on_delete=models.RESTRICT, null=True, blank=True, related_name="+"
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    approval_comment = models.TextField(blank=True, default="")
    # Counts approvals, so the version in force reads as a revision number.
    revision = models.PositiveIntegerField(default=0)

    next_review_date = models.DateField(null=True, blank=True)

    # The content put in force without review when approvals were switched on.
    # In force only while nothing is approved; kept afterwards as history.
    baseline_version = models.ForeignKey(
        "db.PageVersion", on_delete=models.RESTRICT, null=True, blank=True, related_name="+"
    )
    baselined_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    baselined_at = models.DateTimeField(null=True, blank=True)
    # An approval recorded in the page before it came here, as written there.
    # Information only: legacy_approved_by is a name, never mapped to a user.
    legacy_status = models.CharField(max_length=50, blank=True, default="")
    legacy_approved_by = models.CharField(max_length=255, blank=True, default="")
    legacy_approved_at = models.DateField(null=True, blank=True)
    legacy_approved_at_raw = models.CharField(max_length=50, blank=True, default="")

    class Meta:
        verbose_name = "Page Approval"
        verbose_name_plural = "Page Approvals"
        db_table = "page_approvals"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.page_id} <{self.status}>"

    @property
    def in_force_version_id(self):
        return self.approved_version_id or self.baseline_version_id

    @property
    def in_force_version(self):
        if self.approved_version_id:
            return self.approved_version
        return self.baseline_version if self.baseline_version_id else None

    @property
    def in_force_kind(self):
        """IN_FORCE_APPROVED, IN_FORCE_BASELINE, or None when nothing is in force."""
        if self.approved_version_id:
            return self.IN_FORCE_APPROVED
        return self.IN_FORCE_BASELINE if self.baseline_version_id else None


class PageApprovalEvent(BaseModel):
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVIEW_DATE_SET = "review_date_set"
    BASELINED = "baselined"
    ACTION_CHOICES = (
        (SUBMITTED, "Submitted"),
        (APPROVED, "Approved"),
        (REJECTED, "Rejected"),
        (REVIEW_DATE_SET, "Review date set"),
        (BASELINED, "Baselined (migrated, not reviewed in Paperplane)"),
    )

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="page_approval_events")
    project = models.ForeignKey("db.Project", on_delete=models.CASCADE, related_name="page_approval_events")
    page = models.ForeignKey("db.Page", on_delete=models.CASCADE, related_name="approval_events")
    version = models.ForeignKey(
        "db.PageVersion", on_delete=models.RESTRICT, null=True, blank=True, related_name="approval_events"
    )
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    comment = models.TextField(blank=True, default="")
    revision = models.PositiveIntegerField(null=True, blank=True)
    next_review_date = models.DateField(null=True, blank=True)
    # Baselined events only: the approval recorded in the page before, as written.
    legacy_status = models.CharField(max_length=50, blank=True, default="")
    legacy_approved_by = models.CharField(max_length=255, blank=True, default="")
    legacy_approved_at = models.DateField(null=True, blank=True)
    legacy_approved_at_raw = models.CharField(max_length=50, blank=True, default="")

    class Meta:
        verbose_name = "Page Approval Event"
        verbose_name_plural = "Page Approval Events"
        db_table = "page_approval_events"
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["page", "-created_at"], name="page_approval_event_page_idx")]

    def __str__(self):
        return f"{self.page_id} {self.action}"

    def save(self, *args, **kwargs):
        # The log is append-only. Deleting the page still removes it, in bulk.
        if not self._state.adding:
            raise ValueError("Page approval events cannot be changed")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("Page approval events cannot be deleted")


class PageApprover(BaseModel):
    """A project member who may approve or reject the project's pages."""

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="page_approvers")
    project = models.ForeignKey("db.Project", on_delete=models.CASCADE, related_name="page_approvers")
    member = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="page_approver_of")

    class Meta:
        verbose_name = "Page Approver"
        verbose_name_plural = "Page Approvers"
        db_table = "page_approvers"
        ordering = ("created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["project", "member"],
                condition=models.Q(deleted_at__isnull=True),
                name="page_approver_unique_project_member_when_deleted_at_null",
            )
        ]

    def __str__(self):
        return f"{self.project_id} {self.member_id}"
