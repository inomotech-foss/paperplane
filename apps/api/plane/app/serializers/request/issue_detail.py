# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers

from plane.db.models import IssueComment


class IssueCommentWriteSerializer(serializers.Serializer):
    comment_html = serializers.CharField(required=False, allow_blank=True)
    comment_json = serializers.JSONField(required=False, help_text="The editor document of comment_html")
    access = serializers.ChoiceField(
        choices=IssueComment._meta.get_field("access").choices, required=False, help_text="INTERNAL when omitted"
    )


class ReactionCreateSerializer(serializers.Serializer):
    reaction = serializers.CharField(help_text="The emoji code point, such as 128077")


class AttachmentUploadSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, help_text="unnamed when omitted")
    type = serializers.CharField(help_text="The MIME type, one the instance accepts")
    size = serializers.IntegerField(required=False, help_text="In bytes, capped at the instance limit")


class WorkItemQueryValidateSerializer(serializers.Serializer):
    pql = serializers.CharField(allow_blank=True, help_text="valid is false when blank")
    project_id = serializers.UUIDField(required=False, allow_null=True, help_text="Resolves project-scoped names")


# A body keyed by property id. The value is a string, a number, a boolean, null, or a list of strings.
PROPERTY_VALUES_REQUEST = {
    "application/json": {
        "type": "object",
        "additionalProperties": {},
        "description": "Values by property id. Replaces the values of the listed properties.",
    }
}

WORK_ITEM_HISTORY_PARAMETERS = [
    OpenApiParameter(
        name="activity_type",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        enum=["issue-property", "issue-comment"],
        description="Only activities or only comments. Both, sorted by created_at, when omitted",
    ),
    OpenApiParameter(
        name="created_at__gt",
        type=OpenApiTypes.DATETIME,
        location=OpenApiParameter.QUERY,
        description="Only entries created after this time",
    ),
]

BULK_PROPERTY_VALUES_PARAMETERS = [
    OpenApiParameter(
        name="issue_ids",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        description="Comma separated work item ids, every work item of the project when omitted",
    ),
]

PROPERTY_LIST_PARAMETERS = [
    OpenApiParameter(
        name="issue_type",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        description="A type id lists its properties and the unscoped ones. null lists only the unscoped ones",
    ),
    OpenApiParameter(
        name="unscoped",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        enum=["true", "false"],
        description="true lists only the properties without a type",
    ),
]
