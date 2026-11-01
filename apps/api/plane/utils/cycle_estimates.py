# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Case, FloatField, Sum, Value, When
from django.db.models.functions import Cast

from plane.db.models import Issue

STATE_GROUPS = ("backlog", "unstarted", "started", "cancelled", "completed")
ESTIMATE_POINT_KEYS = (*(f"{group}_estimate_points" for group in STATE_GROUPS), "total_estimate_points")


def cycle_estimate_points(slug, project_id, cycle_id):
    """The point estimates of a cycle's work items, per state group and in total."""
    aggregate = (
        Issue.issue_objects.filter(
            estimate_point__estimate__type="points",
            issue_cycle__cycle_id=cycle_id,
            issue_cycle__deleted_at__isnull=True,
            workspace__slug=slug,
            project_id=project_id,
        )
        .annotate(value_as_float=Cast("estimate_point__value", FloatField()))
        .aggregate(
            **{
                f"{group}_estimate_points": Sum(
                    Case(When(state__group=group, then="value_as_float"), default=Value(0), output_field=FloatField())
                )
                for group in STATE_GROUPS
            },
            total_estimate_points=Sum("value_as_float", default=Value(0), output_field=FloatField()),
        )
    )
    return {key: value or 0 for key, value in aggregate.items()}
