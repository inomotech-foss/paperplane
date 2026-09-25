# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.db.models import Dashboard, DashboardWidget
from plane.utils.dashboard_widgets import WidgetDefinitionError, validate_widget_definition

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

    def get_is_owner(self, obj):
        request = self.context.get("request")
        return bool(request and request.user and obj.owned_by_id == request.user.id)


class DashboardWidgetSerializer(BaseSerializer):
    """A widget; its definition is validated by `validate_widget_definition`."""

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
