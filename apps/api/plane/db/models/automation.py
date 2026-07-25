# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import models

# Module imports
from .base import BaseModel


class AutomationScope(models.TextChoices):
    """Where an automation is authored and which work items it can reach."""

    PROJECT = "project", "Project"
    WORKSPACE = "workspace", "Workspace"


class AutomationRunStatus(models.TextChoices):
    SUCCESS = "success", "Success"
    FAILED = "failed", "Failed"
    PARTIAL = "partial", "Partially completed"
    SKIPPED = "skipped", "Skipped"


class AutomationRunTriggerSource(models.TextChoices):
    EVENT = "event", "Event"
    SCHEDULE = "schedule", "Schedule"
    MANUAL = "manual", "Manual"


class Automation(BaseModel):
    """
    A user authored rule: one trigger, an optional condition tree and an
    ordered list of actions.

    Project scoped automations pin a single project. Workspace scoped
    automations either fan out to every project in the workspace
    (``applies_to_all_projects``) or to the subset listed in
    ``AutomationProject``.
    """

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="workspace_automations")
    project = models.ForeignKey(
        "db.Project",
        on_delete=models.CASCADE,
        related_name="project_automations",
        null=True,
        blank=True,
    )
    scope = models.CharField(max_length=32, choices=AutomationScope.choices, default=AutomationScope.PROJECT)
    projects = models.ManyToManyField(
        "db.Project",
        related_name="scoped_automations",
        through="AutomationProject",
        blank=True,
    )
    applies_to_all_projects = models.BooleanField(default=False)

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")

    # `""` until the author picks one; see plane.automation.registry for the keys.
    trigger_type = models.CharField(max_length=127, blank=True, default="")
    trigger_config = models.JSONField(default=dict, blank=True)

    # Filter expression tree, `null` means "run for everything the trigger matches".
    condition = models.JSONField(null=True, blank=True)

    is_enabled = models.BooleanField(default=False)

    # Scheduling bookkeeping, only used by time based triggers.
    next_run_at = models.DateTimeField(null=True, blank=True, db_index=True)

    # Run statistics, kept denormalised so the list view stays a single query.
    last_run_at = models.DateTimeField(null=True, blank=True)
    last_run_status = models.CharField(max_length=32, choices=AutomationRunStatus.choices, null=True, blank=True)
    total_run_count = models.PositiveIntegerField(default=0)
    failed_run_count = models.PositiveIntegerField(default=0)
    total_duration_ms = models.PositiveBigIntegerField(default=0)

    owned_by = models.ForeignKey(
        "db.User",
        on_delete=models.SET_NULL,
        related_name="owned_automations",
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "Automation"
        verbose_name_plural = "Automations"
        db_table = "automations"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["workspace", "is_enabled"], name="automation_workspace_idx"),
            models.Index(fields=["project", "is_enabled"], name="automation_project_idx"),
            models.Index(fields=["trigger_type", "is_enabled"], name="automation_trigger_idx"),
        ]

    def __str__(self):
        return f"{self.name} <{self.workspace_id}>"

    @property
    def average_duration_ms(self):
        if not self.total_run_count:
            return None
        return int(self.total_duration_ms / self.total_run_count)


class AutomationProject(BaseModel):
    """Join table pinning a workspace scoped automation to a specific project."""

    workspace = models.ForeignKey(
        "db.Workspace", on_delete=models.CASCADE, related_name="workspace_automation_projects"
    )
    automation = models.ForeignKey(Automation, on_delete=models.CASCADE, related_name="automation_projects")
    project = models.ForeignKey("db.Project", on_delete=models.CASCADE, related_name="project_automation_links")

    class Meta:
        verbose_name = "Automation Project"
        verbose_name_plural = "Automation Projects"
        db_table = "automation_projects"
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["automation", "project"],
                condition=models.Q(deleted_at__isnull=True),
                name="automation_project_unique_when_deleted_at_null",
            )
        ]

    def __str__(self):
        return f"{self.automation_id} <{self.project_id}>"


class AutomationAction(BaseModel):
    """One step of an automation, executed in ``sort_order`` order."""

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="workspace_automation_actions")
    automation = models.ForeignKey(Automation, on_delete=models.CASCADE, related_name="actions")
    action_type = models.CharField(max_length=127)
    config = models.JSONField(default=dict, blank=True)
    sort_order = models.FloatField(default=65535)

    class Meta:
        verbose_name = "Automation Action"
        verbose_name_plural = "Automation Actions"
        db_table = "automation_actions"
        ordering = ("sort_order",)
        indexes = [models.Index(fields=["automation", "sort_order"], name="automation_action_order_idx")]

    def __str__(self):
        return f"{self.action_type} <{self.automation_id}>"


class AutomationRun(BaseModel):
    """
    One execution of an automation. ``steps`` holds a per action result list so
    the activity feed can explain exactly what happened without extra tables.
    """

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="workspace_automation_runs")
    project = models.ForeignKey(
        "db.Project",
        on_delete=models.CASCADE,
        related_name="project_automation_runs",
        null=True,
        blank=True,
    )
    automation = models.ForeignKey(Automation, on_delete=models.CASCADE, related_name="runs")
    status = models.CharField(max_length=32, choices=AutomationRunStatus.choices)
    trigger_source = models.CharField(
        max_length=32,
        choices=AutomationRunTriggerSource.choices,
        default=AutomationRunTriggerSource.EVENT,
    )
    trigger_type = models.CharField(max_length=127, blank=True, default="")

    # The work item (or other entity) the run acted on, when there is one.
    entity_type = models.CharField(max_length=64, blank=True, default="")
    entity_identifier = models.UUIDField(null=True, blank=True)

    initiator = models.ForeignKey(
        "db.User",
        on_delete=models.SET_NULL,
        related_name="initiated_automation_runs",
        null=True,
        blank=True,
    )

    started_at = models.DateTimeField()
    finished_at = models.DateTimeField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(default=0)

    # Number of work items touched, meaningful for scheduled fan-out runs.
    processed_count = models.PositiveIntegerField(default=0)

    steps = models.JSONField(default=list, blank=True)
    error = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Automation Run"
        verbose_name_plural = "Automation Runs"
        db_table = "automation_runs"
        ordering = ("-started_at",)
        indexes = [
            models.Index(fields=["automation", "-started_at"], name="automation_run_recent_idx"),
            models.Index(fields=["entity_identifier"], name="automation_run_entity_idx"),
        ]

    def __str__(self):
        return f"{self.automation_id} <{self.status}>"
