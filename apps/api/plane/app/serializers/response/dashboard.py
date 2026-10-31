# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from plane.app.serializers.dashboard import (
    DashboardSerializer,
    DashboardWidgetSerializer,
    WidgetDimensionJSONField,
    WidgetMetricJSONField,
)
from plane.db.models import DashboardWidget, PropertyTypeChoices
from plane.utils.dashboard_widgets import DATE_BUCKETS, METRIC_FUNCTIONS


class DashboardDetailSerializer(DashboardSerializer):
    widgets = DashboardWidgetSerializer(many=True)


# Rows carry one extra number per series, so the item schema is written out.
@extend_schema_field(
    {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "key": {"type": "string"},
                "name": {"type": "string"},
                "count": {"type": "number", "nullable": True},
            },
            "required": ["key", "name", "count"],
            "additionalProperties": {"type": "number", "nullable": True},
        },
    }
)
class WidgetRowsField(serializers.JSONField):
    pass


class WidgetDataSerializer(serializers.Serializer):
    data = WidgetRowsField(help_text="One row per dimension value, with a value per series")
    schema = serializers.DictField(child=serializers.CharField(), help_text="Series key to label")
    total = serializers.FloatField(allow_null=True)
    row_count = serializers.IntegerField()
    metric = WidgetMetricJSONField()
    dimension = WidgetDimensionJSONField()
    series = WidgetDimensionJSONField()


class DashboardTypeSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    logo_props = serializers.JSONField()


class DashboardPropertySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    property_type = serializers.ChoiceField(choices=PropertyTypeChoices.choices)
    is_multi = serializers.BooleanField()
    project_id = serializers.UUIDField()
    project_name = serializers.CharField()
    issue_type_id = serializers.UUIDField(allow_null=True)


class DashboardOptionsSerializer(serializers.Serializer):
    chart_types = serializers.ListField(child=serializers.ChoiceField(choices=DashboardWidget.ChartType.choices))
    metric_functions = serializers.ListField(child=serializers.ChoiceField(choices=METRIC_FUNCTIONS))
    date_buckets = serializers.ListField(child=serializers.ChoiceField(choices=DATE_BUCKETS))
    native_dimensions = serializers.ListField(child=serializers.CharField())
    date_dimensions = serializers.ListField(child=serializers.CharField())
    types = DashboardTypeSerializer(many=True)
    properties = DashboardPropertySerializer(many=True)
    metric_properties = DashboardPropertySerializer(many=True)
