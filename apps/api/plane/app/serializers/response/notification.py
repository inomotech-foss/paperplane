# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers


class UnreadNotificationCountSerializer(serializers.Serializer):
    total_unread_notifications_count = serializers.IntegerField()
    mention_unread_notifications_count = serializers.IntegerField()
