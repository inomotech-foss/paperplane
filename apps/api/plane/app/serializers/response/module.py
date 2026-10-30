# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.utils import PolymorphicProxySerializer
from rest_framework import serializers

from plane.app.serializers import ModuleDetailSerializer, ModuleSerializer

from .cycle import DistributionSerializer, EstimateDistributionSerializer


class _ModuleValuesSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    workspace_id = serializers.UUIDField()
    project_id = serializers.UUIDField()
    name = serializers.CharField()
    description = serializers.CharField()
    description_text = serializers.JSONField(allow_null=True)
    description_html = serializers.JSONField(allow_null=True)
    start_date = serializers.DateField(allow_null=True)
    target_date = serializers.DateField(allow_null=True)
    status = serializers.CharField()
    lead_id = serializers.UUIDField(allow_null=True)
    member_ids = serializers.ListField(child=serializers.UUIDField())
    view_props = serializers.JSONField()
    sort_order = serializers.FloatField()
    external_source = serializers.CharField(allow_null=True)
    external_id = serializers.CharField(allow_null=True)
    is_favorite = serializers.BooleanField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class ModuleListItemSerializer(_ModuleValuesSerializer):
    logo_props = serializers.JSONField()
    completed_estimate_points = serializers.FloatField()
    total_estimate_points = serializers.FloatField()
    total_issues = serializers.IntegerField()
    cancelled_issues = serializers.IntegerField()
    completed_issues = serializers.IntegerField()
    started_issues = serializers.IntegerField()
    unstarted_issues = serializers.IntegerField()
    backlog_issues = serializers.IntegerField()


class ArchivedModuleListItemSerializer(_ModuleValuesSerializer):
    total_issues = serializers.IntegerField(allow_null=True)
    cancelled_issues = serializers.IntegerField(allow_null=True)
    completed_issues = serializers.IntegerField(allow_null=True)
    started_issues = serializers.IntegerField(allow_null=True)
    unstarted_issues = serializers.IntegerField(allow_null=True)
    backlog_issues = serializers.IntegerField(allow_null=True)
    archived_at = serializers.DateTimeField()


ModuleListResponse = PolymorphicProxySerializer(
    component_name="ModuleListResponse",
    serializers=[ModuleListItemSerializer(many=True), ModuleSerializer(many=True)],
    resource_type_field_name=None,
    many=False,
    help_text="Full modules when fields is given",
)


class ModuleDetailResponseSerializer(ModuleDetailSerializer):
    estimate_distribution = EstimateDistributionSerializer()
    distribution = DistributionSerializer()

    class Meta(ModuleDetailSerializer.Meta):
        fields = ModuleDetailSerializer.Meta.fields + ["estimate_distribution", "distribution"]
        response_required = ModuleDetailSerializer.Meta.response_required + ("estimate_distribution", "distribution")


class WorkspaceModuleSerializer(ModuleSerializer):
    class Meta(ModuleSerializer.Meta):
        # WorkspaceModulesEndpoint annotates the issue counts only.
        response_required = (
            "total_issues",
            "cancelled_issues",
            "completed_issues",
            "started_issues",
            "unstarted_issues",
            "backlog_issues",
        )
