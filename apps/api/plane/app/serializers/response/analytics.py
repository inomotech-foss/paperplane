# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema_field
from rest_framework import serializers


ANY = {}


class CountSerializer(serializers.Serializer):
    count = serializers.IntegerField()


ANALYTICS_COUNTS = serializers.DictField(child=CountSerializer(), help_text="A count by metric name")


class ProjectWorkItemStatsSerializer(serializers.Serializer):
    project_id = serializers.UUIDField()
    project__name = serializers.CharField()
    cancelled_work_items = serializers.IntegerField()
    completed_work_items = serializers.IntegerField()
    backlog_work_items = serializers.IntegerField()
    un_started_work_items = serializers.IntegerField()
    started_work_items = serializers.IntegerField()


class AssigneeWorkItemStatsSerializer(serializers.Serializer):
    display_name = serializers.CharField(allow_null=True)
    assignee_id = serializers.UUIDField(allow_null=True)
    avatar_url = serializers.CharField(allow_null=True)
    cancelled_work_items = serializers.IntegerField()
    completed_work_items = serializers.IntegerField()
    backlog_work_items = serializers.IntegerField()
    un_started_work_items = serializers.IntegerField()
    started_work_items = serializers.IntegerField()


class ChartPointSerializer(serializers.Serializer):
    key = serializers.CharField()
    name = serializers.CharField()
    count = serializers.IntegerField()


# Rows carry one extra integer per group, so the item schema is written out.
@extend_schema_field(
    {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "key": {"type": "string"},
                "name": {"type": "string"},
                "count": {"type": "integer"},
            },
            "required": ["key", "name", "count"],
            "additionalProperties": {"type": "integer"},
        },
    }
)
class ChartRowsField(serializers.JSONField):
    pass


class ChartSerializer(serializers.Serializer):
    data = ChartRowsField(help_text="One row per x value, with a count per group")
    schema = serializers.DictField(child=serializers.CharField(), help_text="Group key to label")


AdvanceAnalyticsChartResponse = PolymorphicProxySerializer(
    component_name="AdvanceAnalyticsChartResponse",
    serializers=[ChartPointSerializer(many=True), ChartSerializer],
    resource_type_field_name=None,
    many=False,
    help_text="A list of totals for type=projects, a chart otherwise",
)


@extend_schema_field(
    {
        "type": "object",
        "additionalProperties": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "dimension": ANY,
                    "segment": ANY,
                    "count": {"type": "integer"},
                    "estimate": {"type": "number", "nullable": True},
                },
            },
        },
        "description": "Rows by x value. count for issue_count, estimate otherwise, segment with a segment.",
    }
)
class DistributionField(serializers.JSONField):
    pass


class AnalyticsExtrasSerializer(serializers.Serializer):
    state_details = serializers.JSONField()
    assignee_details = serializers.JSONField()
    label_details = serializers.JSONField()
    cycle_details = serializers.JSONField()
    module_details = serializers.JSONField()


class AnalyticsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    distribution = DistributionField()
    extras = AnalyticsExtrasSerializer(help_text="Details for the axes that need them, empty objects otherwise")


class SavedAnalyticsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    distribution = DistributionField()


class StateGroupTotalSerializer(serializers.Serializer):
    state_group = serializers.CharField(allow_null=True)
    state_count = serializers.IntegerField()


class MonthCountSerializer(serializers.Serializer):
    month = serializers.IntegerField()
    count = serializers.IntegerField()


class CreatorCountSerializer(serializers.Serializer):
    created_by__first_name = serializers.CharField()
    created_by__last_name = serializers.CharField()
    created_by__display_name = serializers.CharField()
    created_by__id = serializers.UUIDField()
    created_by__avatar_url = serializers.CharField(allow_null=True)
    count = serializers.IntegerField()


class AssigneeCountSerializer(serializers.Serializer):
    assignees__first_name = serializers.CharField(allow_null=True)
    assignees__last_name = serializers.CharField(allow_null=True)
    assignees__display_name = serializers.CharField(allow_null=True)
    assignees__id = serializers.UUIDField(allow_null=True)
    assignees__avatar_url = serializers.CharField(allow_null=True)
    count = serializers.IntegerField()


class DefaultAnalyticsSerializer(serializers.Serializer):
    total_issues = serializers.IntegerField()
    total_issues_classified = StateGroupTotalSerializer(many=True)
    open_issues = serializers.IntegerField()
    open_issues_classified = StateGroupTotalSerializer(many=True)
    issue_completed_month_wise = MonthCountSerializer(many=True)
    most_issue_created_user = CreatorCountSerializer(many=True)
    most_issue_closed_user = AssigneeCountSerializer(many=True)
    pending_issue_user = AssigneeCountSerializer(many=True)
    open_estimate_sum = serializers.IntegerField(allow_null=True)
    total_estimate_sum = serializers.IntegerField(allow_null=True)
