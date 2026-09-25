# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Dashboards: a board of widgets, each one a PQL query drawn as a chart.

A widget is defined by four things:

* `query`, the Plane Query Language expression selecting the work items
  (`descendantOf("CUST-1") AND type = "Invoice"`), empty for all of them;
* `metric`, what to measure over them: `{"function": "count"}` or an
  aggregate over a decimal custom property or estimate points, such as
  `{"function": "sum", "field": "property:<id>"}`;
* `dimension`, what to split the metric by, such as `{"field": "state"}`,
  `{"field": "target_date", "bucket": "month"}`, `{"field": "property:<id>"}`
  or `{"field": "ancestor:<type id>"}` (the nearest ancestor of that work item
  type: "per customer"); empty for a single number;
* `series`, an optional second dimension for stacked or grouped charts.

`plane.utils.dashboard_widgets` validates and evaluates them.
"""

from django.conf import settings
from django.db import models

from .base import BaseModel


class Dashboard(BaseModel):
    """A named board of widgets in a workspace."""

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="dashboards")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    logo_props = models.JSONField(default=dict)
    access = models.PositiveSmallIntegerField(default=1, choices=((0, "Private"), (1, "Public")))
    owned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_dashboards")
    sort_order = models.FloatField(default=65535)

    class Meta:
        verbose_name = "Dashboard"
        verbose_name_plural = "Dashboards"
        db_table = "dashboards"
        ordering = ("sort_order", "-created_at")

    def save(self, *args, **kwargs):
        if self._state.adding:
            largest = Dashboard.objects.filter(workspace=self.workspace).aggregate(largest=models.Max("sort_order"))[
                "largest"
            ]
            if largest is not None:
                self.sort_order = largest + 10000
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} <{self.workspace.name}>"


class DashboardWidget(BaseModel):
    """One chart on a dashboard: a query, a metric, up to two dimensions."""

    class ChartType(models.TextChoices):
        NUMBER = "number", "Number"
        BAR = "bar", "Bar"
        LINE = "line", "Line"
        AREA = "area", "Area"
        PIE = "pie", "Pie"
        DONUT = "donut", "Donut"
        TABLE = "table", "Table"

    dashboard = models.ForeignKey("db.Dashboard", on_delete=models.CASCADE, related_name="widgets")
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="dashboard_widgets")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    query = models.TextField(blank=True, default="")
    chart_type = models.CharField(max_length=20, choices=ChartType.choices, default=ChartType.BAR)
    metric = models.JSONField(default=dict)
    dimension = models.JSONField(default=dict)
    series = models.JSONField(default=dict)
    config = models.JSONField(default=dict)
    sort_order = models.FloatField(default=65535)

    class Meta:
        verbose_name = "Dashboard Widget"
        verbose_name_plural = "Dashboard Widgets"
        db_table = "dashboard_widgets"
        ordering = ("sort_order", "created_at")

    def save(self, *args, **kwargs):
        if self._state.adding:
            largest = DashboardWidget.objects.filter(dashboard=self.dashboard).aggregate(
                largest=models.Max("sort_order")
            )["largest"]
            if largest is not None:
                self.sort_order = largest + 10000
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} <{self.dashboard_id}>"
