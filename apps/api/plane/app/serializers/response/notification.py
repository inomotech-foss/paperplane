# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers

from plane.utils.openapi.parameters import CURSOR_PARAMETER, PER_PAGE_PARAMETER


class UnreadNotificationCountSerializer(serializers.Serializer):
    total_unread_notifications_count = serializers.IntegerField()
    mention_unread_notifications_count = serializers.IntegerField()


class NotificationIssueDataSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    identifier = serializers.CharField()
    sequence_id = serializers.IntegerField()
    state_name = serializers.CharField(allow_null=True)
    state_group = serializers.CharField(allow_null=True)
    project_id = serializers.CharField(required=False, help_text="Only on mention notifications")
    workspace_slug = serializers.CharField(required=False, help_text="Only on mention notifications")


class NotificationIssueActivityDataSerializer(serializers.Serializer):
    id = serializers.CharField(allow_null=True)
    verb = serializers.CharField()
    field = serializers.CharField(allow_null=True)
    actor = serializers.CharField(allow_null=True)
    new_value = serializers.CharField()
    old_value = serializers.CharField()
    issue_comment = serializers.CharField(required=False)
    old_identifier = serializers.CharField(required=False, allow_null=True)
    new_identifier = serializers.CharField(required=False, allow_null=True)

    class Meta:
        # Automation notifications leave them out.
        response_optional = ("old_identifier", "new_identifier")


class NotificationPageDataSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    project_id = serializers.CharField()
    workspace_slug = serializers.CharField()


class NotificationCommentDataSerializer(serializers.Serializer):
    id = serializers.CharField()


class NotificationAutomationDataSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()


class NotificationDataSerializer(serializers.Serializer):
    """The `data` the notification producers write. Each key is present only for its kind of notification."""

    issue = NotificationIssueDataSerializer(required=False)
    issue_activity = NotificationIssueActivityDataSerializer(required=False)
    page = NotificationPageDataSerializer(required=False)
    comment = NotificationCommentDataSerializer(required=False)
    automation = NotificationAutomationDataSerializer(required=False)


def _query(name, description, enum=None):
    return OpenApiParameter(
        name=name, type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, description=description, enum=enum
    )


NOTIFICATION_LIST_PARAMETERS = [
    _query("snoozed", "false when omitted", enum=["true", "false"]),
    _query("archived", "false when omitted", enum=["true", "false"]),
    _query("read", "Both read and unread when omitted", enum=["true", "false"]),
    _query("type", "Comma separated subscribed, assigned and created. All notifications without any of them"),
    _query("mentioned", "Any non-empty value lists mentions only, otherwise mentions are left out"),
    _query("order_by", "Sort field, -created_at by default"),
    CURSOR_PARAMETER,
    PER_PAGE_PARAMETER,
]
