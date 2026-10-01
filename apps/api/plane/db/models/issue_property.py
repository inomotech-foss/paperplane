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
    """Property types, named as Plane Cloud names them so the Plane SDK can
    read them. A multi-select is OPTION with `is_multi`, and a user reference
    is RELATION with `relation_type`."""

    TEXT = "TEXT", "Text"
    DECIMAL = "DECIMAL", "Decimal"
    OPTION = "OPTION", "Option"
    DATETIME = "DATETIME", "Datetime"
    BOOLEAN = "BOOLEAN", "Boolean"
    RELATION = "RELATION", "Relation"


class PropertyRelationTypeChoices(models.TextChoices):
    """What a RELATION property points at: a user, or a work item (only as a value
    derived from the hierarchy, see `PropertyDerivationChoices.LOOKUP`)."""

    USER = "USER", "User"
    ISSUE = "ISSUE", "Work item"


class PropertyDerivationChoices(models.TextChoices):
    """Where a property's values come from.

    - NONE: people set them.
    - INHERIT: a work item without its own value takes its parent's (effective) value,
      so a value set on a customer flows down to every work item below it. Own values
      still win and flow further down.
    - LOOKUP: the value of the nearest ancestor of a given work item type: the ancestor
      itself (a work item reference, e.g. "Customer") or one of its property values.
      Read-only.
    - ROLLUP: an aggregate over the work items below (sum, count, earliest date...).
      Read-only.

    Derived values are stored as ordinary value rows marked `is_derived`, so filters,
    queries, dashboards and exports see them like any other value. They are recomputed
    whenever the hierarchy, a source value or the configuration changes.
    """

    NONE = "NONE", "Manual"
    INHERIT = "INHERIT", "Inherit from parent"
    LOOKUP = "LOOKUP", "From ancestor"
    ROLLUP = "ROLLUP", "Roll up from children"


class IssueProperty(ProjectBaseModel):
    """A typed custom property (work item property) defined on a project."""

    name = models.CharField(max_length=255)
    display_name = models.CharField(max_length=255)
    property_type = models.CharField(
        max_length=30,
        choices=PropertyTypeChoices.choices,
        default=PropertyTypeChoices.TEXT,
    )
    is_multi = models.BooleanField(default=False)
    relation_type = models.CharField(
        max_length=30,
        choices=PropertyRelationTypeChoices.choices,
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(default=True)
    is_required = models.BooleanField(default=False)
    sort_order = models.FloatField(default=65535)
    settings = models.JSONField(default=dict)
    external_source = models.CharField(max_length=255, null=True, blank=True)
    external_id = models.CharField(max_length=255, blank=True, null=True)
    issue_type = models.ForeignKey(
        "db.IssueType",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="issue_properties",
        db_index=True,
        help_text="The work item type this property is scoped to. NULL means the property applies to every work item type in the project.",  # noqa: E501
    )
    derivation = models.CharField(
        max_length=20,
        choices=PropertyDerivationChoices.choices,
        default=PropertyDerivationChoices.NONE,
    )
    # INHERIT: {}. LOOKUP: {"issue_type": id, "source": "item" | property id, "include_self": bool}.
    # ROLLUP: {"source": property id | "start_date" | "target_date" | "items", "function": ...,
    #          "scope": "children" | "descendants", "issue_type": id | null, "include_self": bool}.
    derivation_config = models.JSONField(default=dict, blank=True)

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

    @property
    def is_multi_option(self):
        """Whether this property holds several options at once."""
        return self.property_type == PropertyTypeChoices.OPTION and self.is_multi

    @property
    def is_computed(self):
        """Whether the values come only from the hierarchy, so nobody can set them."""
        return self.derivation in (PropertyDerivationChoices.LOOKUP, PropertyDerivationChoices.ROLLUP)

    @property
    def is_issue_relation(self):
        return (
            self.property_type == PropertyTypeChoices.RELATION
            and self.relation_type == PropertyRelationTypeChoices.ISSUE
        )

    def save(self, *args, **kwargs):
        if self._state.adding:
            # Get the maximum sort order value from the database
            last_id = IssueProperty.objects.filter(project=self.project).aggregate(largest=models.Max("sort_order"))[
                "largest"
            ]
            # if last_id is not None
            if last_id is not None:
                self.sort_order = last_id + 10000

        super(IssueProperty, self).save(*args, **kwargs)

    def __str__(self):
        return str(self.name)


class IssuePropertyOption(ProjectBaseModel):
    """A selectable option for OPTION issue properties."""

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
    ``property_type`` of the related property. Multi-select properties store
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
    value_issue = models.ForeignKey(
        "db.Issue",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="+",
    )
    # Computed from the hierarchy (see IssueProperty.derivation) rather than set by someone.
    is_derived = models.BooleanField(default=False)
    external_source = models.CharField(max_length=255, null=True, blank=True)
    external_id = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        unique_together = ["issue", "property", "value_option", "deleted_at"]
        indexes = [
            models.Index(fields=["property", "value_number"], name="issue_prop_value_number_idx"),
            models.Index(fields=["property", "value_option"], name="issue_prop_value_option_idx"),
            models.Index(fields=["issue"], name="issue_prop_value_issue_idx"),
            models.Index(fields=["property", "value_issue"], name="issue_prop_value_ref_idx"),
        ]
        verbose_name = "Issue Property Value"
        verbose_name_plural = "Issue Property Values"
        db_table = "issue_property_values"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.issue_id} - {self.property_id}"
