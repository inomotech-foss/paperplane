# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.app.serializers import ModuleDetailSerializer, ModuleSerializer
from plane.db.models.module import ModuleStatus

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
    status = serializers.ChoiceField(choices=ModuleStatus.choices)
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
