# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers

from plane.db.models.project import ROLE_CHOICES


class ProjectLinkReorderSerializer(serializers.Serializer):
    link_ids = serializers.ListField(child=serializers.UUIDField(), help_text="Every link of the project, in order")


class ProjectIdentifierNameSerializer(serializers.Serializer):
    name = serializers.CharField(help_text="The identifier to release")


class ProjectMemberAddSerializer(serializers.Serializer):
    member_id = serializers.UUIDField()
    role = serializers.ChoiceField(choices=ROLE_CHOICES)


class ProjectMembersAddSerializer(serializers.Serializer):
    members = ProjectMemberAddSerializer(many=True)


class ProjectInvitationJoinSerializer(serializers.Serializer):
    token = serializers.CharField(help_text="The token from the invitation email")
    accepted = serializers.BooleanField(required=False, help_text="False when omitted, which declines")


class ProjectIssueSequenceSerializer(serializers.Serializer):
    start = serializers.IntegerField(min_value=1, help_text="The sequence number of the next work item")


class ProjectFavoriteSerializer(serializers.Serializer):
    project = serializers.UUIDField()


class DeployBoardViewPropsSerializer(serializers.Serializer):
    list = serializers.BooleanField(required=False)
    kanban = serializers.BooleanField(required=False)
    calendar = serializers.BooleanField(required=False)
    gantt = serializers.BooleanField(required=False)
    spreadsheet = serializers.BooleanField(required=False)


class DeployBoardCreateSerializer(serializers.Serializer):
    is_comments_enabled = serializers.BooleanField(required=False, help_text="False when omitted")
    is_reactions_enabled = serializers.BooleanField(required=False, help_text="False when omitted")
    is_votes_enabled = serializers.BooleanField(required=False, help_text="False when omitted")
    intake = serializers.UUIDField(required=False, allow_null=True, help_text="An intake of the project")
    intake_issue_type = serializers.UUIDField(required=False, allow_null=True, help_text="Required with intake")
    views = DeployBoardViewPropsSerializer(required=False, help_text="Every layout when omitted")


class IssueExportSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=["csv", "xlsx", "json"])
    project = serializers.ListField(
        child=serializers.UUIDField(), required=False, help_text="Every project of the caller when omitted"
    )
    multiple = serializers.BooleanField(required=False, help_text="One file per project")


def _query(name, description, type=OpenApiTypes.STR, required=False, enum=None):
    return OpenApiParameter(
        name=name, type=type, location=OpenApiParameter.QUERY, description=description, required=required, enum=enum
    )


PROJECT_IDENTIFIER_PARAMETERS = [_query("name", "The identifier to look up, a 400 when missing", required=True)]

PROJECT_STATS_PARAMETERS = [
    _query("fields", "Comma separated total_issues, completed_issues, total_members, total_cycles, total_modules"),
    _query("project_ids", "Comma separated project ids, every visible project when omitted"),
]

_FLAG = ["true", "false"]

WORK_ITEM_SEARCH_PARAMETERS = [
    _query("search", "Matches the name and the sequence id"),
    _query("workspace_search", "true searches every project of the workspace", enum=_FLAG),
    _query("issue_id", "The work item the other flags relate to"),
    _query("parent", "true leaves out issue_id and its parent", enum=_FLAG),
    _query("issue_relation", "true leaves out work items related to issue_id", enum=_FLAG),
    _query("sub_issue", "true lists only root work items that can become sub-items of issue_id", enum=_FLAG),
    _query("cycle", "true leaves out work items in a cycle", enum=_FLAG),
    _query("module", "Leaves out work items in this module"),
    _query("target_date", "none lists only work items without a target date"),
    _query("has_children", "true lists only parents of other work items", enum=_FLAG),
    _query("limit", "100 by default, at most 2000", type=OpenApiTypes.INT),
]

EXPORT_HISTORY_PARAMETERS = [
    _query("cursor", "Required, a 400 without it", required=True),
    _query("per_page", "Required, a 400 without it", type=OpenApiTypes.INT, required=True),
    _query("order_by", "Sort field, -created_at by default"),
]
