# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.db.models import Dashboard, DashboardWidget
from plane.utils.dashboard_widgets import (
    DATE_BUCKETS,
    METRIC_FUNCTIONS,
    WidgetDefinitionError,
    validate_widget_definition,
)
from plane.utils.openapi.fields import typed_json

from .base import BaseSerializer


class DashboardSerializer(BaseSerializer):
    widget_count = serializers.IntegerField(read_only=True)
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = Dashboard
        fields = "__all__"
        read_only_fields = [
            "id",
            "workspace",
            "owned_by",
            "sort_order",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "deleted_at",
        ]

    def get_is_owner(self, obj) -> bool:
        request = self.context.get("request")
        return bool(request and request.user and obj.owned_by_id == request.user.id)


class WidgetMetricSerializer(serializers.Serializer):
    function = serializers.ChoiceField(choices=METRIC_FUNCTIONS)
    field = serializers.CharField(required=False, help_text="property:<id> or estimate_points. Absent for count")


class WidgetDimensionSerializer(serializers.Serializer):
    """What a widget splits its metric by. An empty object for none."""

    field = serializers.CharField(
        required=False, help_text="A native field, a date field, property:<id> or ancestor:<type id>"
    )
    bucket = serializers.ChoiceField(choices=DATE_BUCKETS, required=False, help_text="Set for a date field")


WidgetMetricJSONField = typed_json(WidgetMetricSerializer)
WidgetDimensionJSONField = typed_json(WidgetDimensionSerializer)


class WidgetDefinitionSerializer(serializers.Serializer):
    """The part of a widget that decides what it shows."""

    chart_type = serializers.ChoiceField(
        choices=DashboardWidget.ChartType.choices, required=False, help_text="bar when omitted"
    )
    query = serializers.CharField(
        required=False, allow_blank=True, help_text="A PQL filter. Every work item when empty"
    )
    metric = WidgetMetricJSONField(required=False)
    dimension = WidgetDimensionJSONField(required=False)
    series = WidgetDimensionJSONField(required=False)


class DashboardWidgetSerializer(BaseSerializer):
    """A widget; its definition is validated by `validate_widget_definition`."""

    metric = WidgetMetricJSONField(required=False)
    dimension = WidgetDimensionJSONField(required=False)
    series = WidgetDimensionJSONField(required=False)

    class Meta:
        model = DashboardWidget
        fields = "__all__"
        read_only_fields = [
            "id",
            "workspace",
            "dashboard",
            "sort_order",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "deleted_at",
        ]

    def validate(self, data):
        definition = {
            key: data.get(key, getattr(self.instance, key, None))
            for key in ("chart_type", "query", "metric", "dimension", "series")
        }
        try:
            normalised = validate_widget_definition(definition, self.context["slug"])
        except WidgetDefinitionError as exc:
            raise serializers.ValidationError({exc.field or "non_field_errors": [exc.message]}) from exc
        data.update(normalised)
        return data
