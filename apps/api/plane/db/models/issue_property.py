# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.conf import settings
from django.db import models
from django.db.models import Q

# Module imports
from .project import ProjectBaseModel


class PropertyTypeChoices(models.TextChoices):
    TEXT = "TEXT", "Text"
    NUMBER = "NUMBER", "Number"
    OPTION = "OPTION", "Option"
    MULTI_OPTION = "MULTI_OPTION", "Multi Option"
    DATE = "DATE", "Date"
    BOOLEAN = "BOOLEAN", "Boolean"
    USER = "USER", "User"


class IssueProperty(ProjectBaseModel):
    """A typed custom property (work item property) defined on a project."""

    name = models.CharField(max_length=255)
    display_name = models.CharField(max_length=255)
    property_type = models.CharField(
        max_length=30,
        choices=PropertyTypeChoices.choices,
        default=PropertyTypeChoices.TEXT,
    )
    is_active = models.BooleanField(default=True)
    is_required = models.BooleanField(default=False)
    sort_order = models.FloatField(default=65535)
    settings = models.JSONField(default=dict)
    external_source = models.CharField(max_length=255, null=True, blank=True)
    external_id = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        unique_together = ["project", "name", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"],
                condition=Q(deleted_at__isnull=True),
                name="issue_property_unique_project_name_when_deleted_at_null",
            )
        ]
        verbose_name = "Issue Property"
        verbose_name_plural = "Issue Properties"
        db_table = "issue_properties"
        ordering = ("sort_order",)

    def save(self, *args, **kwargs):
        if self._state.adding:
            # Get the maximum sort order value from the database
            last_id = IssueProperty.objects.filter(project=self.project).aggregate(
                largest=models.Max("sort_order")
            )["largest"]
            # if last_id is not None
            if last_id is not None:
                self.sort_order = last_id + 10000

        super(IssueProperty, self).save(*args, **kwargs)

    def __str__(self):
        return str(self.name)


class IssuePropertyOption(ProjectBaseModel):
    """A selectable option for OPTION / MULTI_OPTION issue properties."""

    property = models.ForeignKey(
        "db.IssueProperty",
        on_delete=models.CASCADE,
        related_name="options",
    )
    name = models.CharField(max_length=255)
    sort_order = models.FloatField(default=65535)
    is_default = models.BooleanField(default=False)
    external_source = models.CharField(max_length=255, null=True, blank=True)
    external_id = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        unique_together = ["property", "name", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["property", "name"],
                condition=Q(deleted_at__isnull=True),
                name="issue_property_option_unique_property_name_when_deleted_at_null",
            )
        ]
        verbose_name = "Issue Property Option"
        verbose_name_plural = "Issue Property Options"
        db_table = "issue_property_options"
        ordering = ("sort_order",)

    def save(self, *args, **kwargs):
        if self._state.adding:
            # Get the maximum sort order value from the database
            last_id = IssuePropertyOption.objects.filter(property=self.property).aggregate(
                largest=models.Max("sort_order")
            )["largest"]
            # if last_id is not None
            if last_id is not None:
                self.sort_order = last_id + 10000

        super(IssuePropertyOption, self).save(*args, **kwargs)

    def __str__(self):
        return str(self.name)


class IssuePropertyValue(ProjectBaseModel):
    """A typed value of an issue property on a work item.

    Exactly one of the ``value_*`` columns is populated, depending on the
    ``property_type`` of the related property. MULTI_OPTION properties store
    one row per selected option.
    """

    issue = models.ForeignKey(
        "db.Issue",
        on_delete=models.CASCADE,
        related_name="property_values",
    )
    property = models.ForeignKey(
        "db.IssueProperty",
        on_delete=models.CASCADE,
        related_name="values",
    )
    value_text = models.TextField(null=True, blank=True)
    value_number = models.DecimalField(max_digits=30, decimal_places=10, null=True, blank=True)
    value_option = models.ForeignKey(
        "db.IssuePropertyOption",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="+",
    )
    value_date = models.DateTimeField(null=True, blank=True)
    value_boolean = models.BooleanField(null=True, blank=True)
    value_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        unique_together = ["issue", "property", "value_option", "deleted_at"]
        indexes = [
            models.Index(fields=["property", "value_number"], name="issue_prop_value_number_idx"),
            models.Index(fields=["property", "value_option"], name="issue_prop_value_option_idx"),
            models.Index(fields=["issue"], name="issue_prop_value_issue_idx"),
        ]
        verbose_name = "Issue Property Value"
        verbose_name_plural = "Issue Property Values"
        db_table = "issue_property_values"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.issue_id} - {self.property_id}"
