# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers


class ActivityCountSerializer(serializers.Serializer):
    created_date = serializers.DateField()
    activity_count = serializers.IntegerField()


class CompletedIssueWeekSerializer(serializers.Serializer):
    week = serializers.IntegerField(help_text="ISO week of completion modulo 4")
    completed_count = serializers.IntegerField()


class CompletedIssueWeekInMonthSerializer(serializers.Serializer):
    week_in_month = serializers.IntegerField()
    completed_count = serializers.IntegerField()


class StateGroupCountSerializer(serializers.Serializer):
    state_group = serializers.CharField(allow_null=True)
    state_count = serializers.IntegerField()


class PriorityCountSerializer(serializers.Serializer):
    priority = serializers.CharField()
    priority_count = serializers.IntegerField()
    priority_order = serializers.IntegerField()


class DashboardIssueSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    workspace__slug = serializers.CharField()
    project_id = serializers.UUIDField()


class OverdueIssueSerializer(DashboardIssueSerializer):
    target_date = serializers.DateField()


class UpcomingIssueSerializer(DashboardIssueSerializer):
    start_date = serializers.DateField()


class UserWorkspaceDashboardSerializer(serializers.Serializer):
    issue_activities = ActivityCountSerializer(many=True)
    completed_issues = CompletedIssueWeekInMonthSerializer(many=True)
    assigned_issues_count = serializers.IntegerField()
    pending_issues_count = serializers.IntegerField()
    completed_issues_count = serializers.IntegerField()
    issues_due_week_count = serializers.IntegerField()
    state_distribution = StateGroupCountSerializer(many=True)
    overdue_issues = OverdueIssueSerializer(many=True)
    upcoming_issues = UpcomingIssueSerializer(many=True)


class UserCycleSerializer(serializers.Serializer):
    cycle__name = serializers.CharField()
    cycle__id = serializers.UUIDField()
    cycle__project_id = serializers.UUIDField()


class WorkspaceUserStatsSerializer(serializers.Serializer):
    state_distribution = StateGroupCountSerializer(many=True)
    priority_distribution = PriorityCountSerializer(many=True)
    created_issues = serializers.IntegerField()
    assigned_issues = serializers.IntegerField()
    completed_issues = serializers.IntegerField()
    pending_issues = serializers.IntegerField()
    subscribed_issues = serializers.IntegerField()
    present_cycles = UserCycleSerializer(many=True)
    upcoming_cycles = UserCycleSerializer(many=True)


class UserProjectIssueCountsSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    logo_props = serializers.JSONField()
    created_issues = serializers.IntegerField()
    assigned_issues = serializers.IntegerField()
    completed_issues = serializers.IntegerField()
    pending_issues = serializers.IntegerField()


class WorkspaceUserDataSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    avatar_url = serializers.CharField(allow_null=True)
    cover_image_url = serializers.CharField(allow_null=True)
    date_joined = serializers.DateTimeField()
    user_timezone = serializers.CharField()
    display_name = serializers.CharField()


class WorkspaceUserProfileSerializer(serializers.Serializer):
    project_data = UserProjectIssueCountsSerializer(
        many=True, help_text="Empty unless the caller is a workspace admin or member"
    )
    user_data = WorkspaceUserDataSerializer()
