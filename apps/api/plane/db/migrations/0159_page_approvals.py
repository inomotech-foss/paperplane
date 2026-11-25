# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0158_estimate_time_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="is_page_approval_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name="PageApproval",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Deleted At")),
                (
                    "id",
                    models.UUIDField(
                        db_index=True,
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        unique=True,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Draft"),
                            ("in_review", "In review"),
                            ("approved", "Approved"),
                            ("rejected", "Rejected"),
                        ],
                        default="draft",
                        max_length=20,
                    ),
                ),
                ("submitted_at", models.DateTimeField(blank=True, null=True)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                ("approval_comment", models.TextField(blank=True, default="")),
                ("revision", models.PositiveIntegerField(default=0)),
                ("next_review_date", models.DateField(blank=True, null=True)),
                (
                    "approved_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "approved_version",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.RESTRICT,
                        related_name="+",
                        to="db.pageversion",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_created_by",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Created By",
                    ),
                ),
                (
                    "page",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE, related_name="approval", to="db.page"
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="page_approvals", to="db.project"
                    ),
                ),
                (
                    "submitted_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "submitted_version",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.RESTRICT,
                        related_name="+",
                        to="db.pageversion",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_updated_by",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Last Modified By",
                    ),
                ),
                (
                    "workspace",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="page_approvals", to="db.workspace"
                    ),
                ),
            ],
            options={
                "verbose_name": "Page Approval",
                "verbose_name_plural": "Page Approvals",
                "db_table": "page_approvals",
                "ordering": ("-created_at",),
            },
        ),
        migrations.CreateModel(
            name="PageApprovalEvent",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Deleted At")),
                (
                    "id",
                    models.UUIDField(
                        db_index=True,
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        unique=True,
                    ),
                ),
                (
                    "action",
                    models.CharField(
                        choices=[
                            ("submitted", "Submitted"),
                            ("approved", "Approved"),
                            ("rejected", "Rejected"),
                            ("review_date_set", "Review date set"),
                        ],
                        max_length=30,
                    ),
                ),
                ("comment", models.TextField(blank=True, default="")),
                ("revision", models.PositiveIntegerField(blank=True, null=True)),
                ("next_review_date", models.DateField(blank=True, null=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_created_by",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Created By",
                    ),
                ),
                (
                    "page",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="approval_events", to="db.page"
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="page_approval_events",
                        to="db.project",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_updated_by",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Last Modified By",
                    ),
                ),
                (
                    "version",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.RESTRICT,
                        related_name="approval_events",
                        to="db.pageversion",
                    ),
                ),
                (
                    "workspace",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="page_approval_events",
                        to="db.workspace",
                    ),
                ),
            ],
            options={
                "verbose_name": "Page Approval Event",
                "verbose_name_plural": "Page Approval Events",
                "db_table": "page_approval_events",
                "ordering": ("-created_at",),
                "indexes": [models.Index(fields=["page", "-created_at"], name="page_approval_event_page_idx")],
            },
        ),
        migrations.CreateModel(
            name="PageApprover",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Deleted At")),
                (
                    "id",
                    models.UUIDField(
                        db_index=True,
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        unique=True,
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_created_by",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Created By",
                    ),
                ),
                (
                    "member",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="page_approver_of",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="page_approvers", to="db.project"
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_updated_by",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Last Modified By",
                    ),
                ),
                (
                    "workspace",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="page_approvers", to="db.workspace"
                    ),
                ),
            ],
            options={
                "verbose_name": "Page Approver",
                "verbose_name_plural": "Page Approvers",
                "db_table": "page_approvers",
                "ordering": ("created_at",),
                "constraints": [
                    models.UniqueConstraint(
                        condition=models.Q(("deleted_at__isnull", True)),
                        fields=("project", "member"),
                        name="page_approver_unique_project_member_when_deleted_at_null",
                    )
                ],
            },
        ),
    ]
