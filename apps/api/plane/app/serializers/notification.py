# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from .base import BaseSerializer
from .user import UserLiteSerializer
from .response.notification import NotificationDataSerializer
from plane.db.models import Notification, UserNotificationPreference
from plane.utils.openapi.fields import typed_json

# Third Party imports
from rest_framework import serializers


class NotificationSerializer(BaseSerializer):
    # Same fields ModelSerializer builds for the nullable JSON columns, with their documented shape.
    data = typed_json(NotificationDataSerializer)(allow_null=True, required=False)
    message = typed_json(serializers.CharField(allow_null=True))(allow_null=True, required=False)
    triggered_by_details = UserLiteSerializer(read_only=True, source="triggered_by")
    is_inbox_issue = serializers.BooleanField(read_only=True)
    is_intake_issue = serializers.BooleanField(read_only=True)
    is_mentioned_notification = serializers.BooleanField(read_only=True)

    class Meta:
        model = Notification
        fields = "__all__"


class UserNotificationPreferenceSerializer(BaseSerializer):
    class Meta:
        model = UserNotificationPreference
        fields = "__all__"
        read_only_fields = ["user", "workspace", "project", "created_by", "updated_by", "deleted_at"]
