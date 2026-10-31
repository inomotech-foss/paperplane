# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from plane.db.models import IssueEmailMessage, IssueEmailThread, ServiceDeskConfig
from plane.utils.openapi.fields import typed_json

from .base import BaseSerializer

_EmailListField = typed_json(serializers.ListField(child=serializers.EmailField()))


class EmailAttachmentRecordSerializer(serializers.Serializer):
    name = serializers.CharField()
    content_type = serializers.CharField()
    size = serializers.IntegerField()
    asset_id = serializers.UUIDField(allow_null=True)
    skipped = serializers.CharField(required=False, help_text="Why the attachment was not stored")


class ServiceDeskConfigSerializer(BaseSerializer):
    issue_type_id = serializers.UUIDField(read_only=True, allow_null=True)
    notify_user_ids = typed_json(serializers.ListField(child=serializers.UUIDField()))(required=False)

    class Meta:
        model = ServiceDeskConfig
        fields = [
            "id",
            "workspace",
            "project",
            "mailbox_email",
            "is_enabled",
            "issue_type_id",
            "notify_mode",
            "notify_user_ids",
            "last_synced_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "workspace", "project", "last_synced_at", "created_at", "updated_at"]


class IssueEmailMessageSerializer(BaseSerializer):
    to_emails = _EmailListField(read_only=True)
    cc_emails = _EmailListField(read_only=True)
    attachments = typed_json(EmailAttachmentRecordSerializer(many=True))(read_only=True)

    class Meta:
        model = IssueEmailMessage
        fields = [
            "id",
            "thread",
            "direction",
            "status",
            "from_email",
            "to_emails",
            "cc_emails",
            "subject",
            "body_text",
            "comment",
            "attachments",
            "error",
            "created_at",
        ]
        read_only_fields = fields


class IssueEmailThreadSerializer(BaseSerializer):
    messages = IssueEmailMessageSerializer(many=True, read_only=True)
    to_emails = _EmailListField(required=False)
    cc_emails = _EmailListField(required=False)

    class Meta:
        model = IssueEmailThread
        fields = [
            "id",
            "workspace",
            "project",
            "issue",
            "mailbox_email",
            "creator_email",
            "creator_name",
            "subject",
            "to_emails",
            "cc_emails",
            "messages",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "workspace",
            "project",
            "issue",
            "mailbox_email",
            "creator_email",
            "creator_name",
            "subject",
            "messages",
            "created_at",
            "updated_at",
        ]
