# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.utils.openapi.fields import typed_json

COUNTS = ("total_issues", "completed_issues", "pending_issues")
ESTIMATES = ("total_estimates", "completed_estimates", "pending_estimates")


class _DistributionSerializer(serializers.Serializer):
    total_issues = serializers.IntegerField()
    completed_issues = serializers.IntegerField()
    pending_issues = serializers.IntegerField()
    total_estimates = serializers.FloatField(allow_null=True)
    completed_estimates = serializers.FloatField(allow_null=True)
    pending_estimates = serializers.FloatField(allow_null=True)


class AssigneeDistributionSerializer(_DistributionSerializer):
    """Issue counts for the issue distribution, estimate sums for the estimate one."""

    assignee_id = serializers.UUIDField(allow_null=True)
    display_name = serializers.CharField(allow_null=True)
    avatar_url = serializers.CharField(allow_null=True)
    first_name = serializers.CharField(allow_null=True)
    last_name = serializers.CharField(allow_null=True)

    class Meta:
        response_optional = COUNTS + ESTIMATES + ("first_name", "last_name")


class LabelDistributionSerializer(_DistributionSerializer):
    label_id = serializers.UUIDField(allow_null=True)
    label_name = serializers.CharField(allow_null=True)
    color = serializers.CharField(allow_null=True)

    class Meta:
        response_optional = COUNTS + ESTIMATES


COMPLETION_CHART = serializers.DictField(
    child=serializers.FloatField(allow_null=True), help_text="Pending work by date, null for future dates"
)


class DistributionSerializer(serializers.Serializer):
    assignees = AssigneeDistributionSerializer(many=True)
    labels = LabelDistributionSerializer(many=True)
    completion_chart = COMPLETION_CHART


class EstimateDistributionSerializer(DistributionSerializer):
    """Empty unless the project estimates in points. The chart needs start and end dates."""

    class Meta:
        response_optional = ("assignees", "labels", "completion_chart")


CYCLE_STATUSES = ("CURRENT", "UPCOMING", "COMPLETED", "DRAFT")


class ProgressSnapshotSerializer(serializers.Serializer):
    """The progress of a cycle when its open work items moved to another cycle. Empty until then."""

    total_issues = serializers.IntegerField()
    completed_issues = serializers.IntegerField()
    cancelled_issues = serializers.IntegerField()
    started_issues = serializers.IntegerField()
    unstarted_issues = serializers.IntegerField()
    backlog_issues = serializers.IntegerField()
    total_estimate_points = serializers.FloatField()
    completed_estimate_points = serializers.FloatField()
    cancelled_estimate_points = serializers.FloatField()
    started_estimate_points = serializers.FloatField()
    unstarted_estimate_points = serializers.FloatField()
    backlog_estimate_points = serializers.FloatField()
    distribution = DistributionSerializer()
    estimate_distribution = EstimateDistributionSerializer()

    class Meta:
        response_optional = (
            "total_issues",
            "completed_issues",
            "cancelled_issues",
            "started_issues",
            "unstarted_issues",
            "backlog_issues",
            "total_estimate_points",
            "completed_estimate_points",
            "cancelled_estimate_points",
            "started_estimate_points",
            "unstarted_estimate_points",
            "backlog_estimate_points",
            "distribution",
            "estimate_distribution",
        )


ProgressSnapshotField = typed_json(ProgressSnapshotSerializer)


class _CycleValuesSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    workspace_id = serializers.UUIDField()
    project_id = serializers.UUIDField()
    name = serializers.CharField()
    description = serializers.CharField()
    start_date = serializers.DateTimeField(allow_null=True)
    end_date = serializers.DateTimeField(allow_null=True)
    owned_by_id = serializers.UUIDField()
    view_props = serializers.JSONField()
    sort_order = serializers.FloatField()
    external_source = serializers.CharField(allow_null=True)
    external_id = serializers.CharField(allow_null=True)
    progress_snapshot = ProgressSnapshotField()
    is_favorite = serializers.BooleanField()
    total_issues = serializers.IntegerField()
    completed_issues = serializers.IntegerField()
    assignee_ids = serializers.ListField(child=serializers.UUIDField())
    status = serializers.ChoiceField(choices=CYCLE_STATUSES)


class CycleSnapshotSerializer(_CycleValuesSerializer):
    logo_props = serializers.JSONField()
    version = serializers.IntegerField()
    created_by = serializers.UUIDField(allow_null=True)


class CycleListItemSerializer(CycleSnapshotSerializer):
    cancelled_issues = serializers.IntegerField()


class CycleDetailSerializer(CycleSnapshotSerializer):
    sub_issues = serializers.IntegerField()


class _ArchivedCycleCountsSerializer(_CycleValuesSerializer):
    cancelled_issues = serializers.IntegerField()
    started_issues = serializers.IntegerField(allow_null=True)
    unstarted_issues = serializers.IntegerField(allow_null=True)
    backlog_issues = serializers.IntegerField(allow_null=True)
    archived_at = serializers.DateTimeField()


class ArchivedCycleListItemSerializer(_ArchivedCycleCountsSerializer):
    pass


class ArchivedCycleDetailSerializer(_ArchivedCycleCountsSerializer):
    sub_issues = serializers.IntegerField()
    logo_props = serializers.JSONField()
    completed_estimate_points = serializers.FloatField(allow_null=True)
    total_estimate_points = serializers.FloatField(allow_null=True)
    created_by = serializers.UUIDField(allow_null=True)
    estimate_distribution = EstimateDistributionSerializer()
    distribution = DistributionSerializer()


class CycleProgressSerializer(serializers.Serializer):
    backlog_estimate_points = serializers.FloatField()
    unstarted_estimate_points = serializers.FloatField()
    started_estimate_points = serializers.FloatField()
    cancelled_estimate_points = serializers.FloatField()
    completed_estimate_points = serializers.FloatField()
    total_estimate_points = serializers.FloatField()
    backlog_issues = serializers.IntegerField()
    total_issues = serializers.IntegerField()
    completed_issues = serializers.IntegerField()
    cancelled_issues = serializers.IntegerField()
    started_issues = serializers.IntegerField()
    unstarted_issues = serializers.IntegerField()


class CycleDateCheckSerializer(serializers.Serializer):
    status = serializers.BooleanField(help_text="False when another cycle overlaps the dates")
    error = serializers.CharField(required=False)
