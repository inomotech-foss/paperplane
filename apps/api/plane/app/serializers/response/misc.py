# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.app.serializers import (
    IssueCommentSerializer,
    IssueEmailMessageSerializer,
    ProjectLiteSerializer,
    WebhookSerializer,
    WorkspaceLiteSerializer,
)
from plane.db.models import Webhook


class TimezoneSerializer(serializers.Serializer):
    utc_offset = serializers.CharField()
    gmt_offset = serializers.CharField()
    value = serializers.CharField()
    label = serializers.CharField()


class TimezoneListSerializer(serializers.Serializer):
    timezones = TimezoneSerializer(many=True)


class AssistantReplySerializer(serializers.Serializer):
    response = serializers.CharField()
    response_html = serializers.CharField()


class ProjectAssistantReplySerializer(AssistantReplySerializer):
    project_detail = ProjectLiteSerializer()
    workspace_detail = WorkspaceLiteSerializer()


class EmailReplySerializer(serializers.Serializer):
    comment = IssueCommentSerializer()
    email_message = IssueEmailMessageSerializer()


class WebhookWithoutSecretSerializer(WebhookSerializer):
    """The webhook as list, retrieve and update return it, without the signing secret."""

    class Meta:
        model = Webhook
        exclude = ["secret_key"]
