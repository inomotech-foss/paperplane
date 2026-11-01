# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers

from plane.app.serializers.draft import DraftIssueCreateSerializer
from plane.app.serializers.issue import IssueCreateSerializer
from plane.utils.openapi.parameters import (
    CURSOR_PARAMETER,
    FILTERS_PARAMETER,
    ORDER_BY_PARAMETER,
    PER_PAGE_PARAMETER,
    PQL_PARAMETER,
)

GROUP_BY_FIELDS = (
    "state_id",
    "state__group",
    "priority",
    "labels__id",
    "assignees__id",
    "cycle_id",
    "issue_module__module_id",
    "target_date",
    "start_date",
    "project_id",
    "created_by",
)


def _query(name, description, type=OpenApiTypes.STR, enum=None):
    return OpenApiParameter(
        name=name, description=description, type=type, location=OpenApiParameter.QUERY, required=False, enum=enum
    )


def _id_list(name, what):
    return _query(name, f"Comma-separated {what} ids. Only work items that match one of them.")


LIST_GROUP_BY_PARAMETER = _query("group_by", "Group the work items by this field", enum=GROUP_BY_FIELDS)
LIST_SUB_GROUP_BY_PARAMETER = _query(
    "sub_group_by", "Group each group by this field. Requires group_by and must differ from it", enum=GROUP_BY_FIELDS
)
SUB_ISSUE_PARAMETER = _query(
    "sub_issue", "Include work items that have a parent. True when omitted", type=OpenApiTypes.BOOL
)
LAYOUT_PARAMETER = _query("layout", "The layout the list is for. Ignored by the backend")
EXPAND_ISSUE_PARAMETER = _query(
    "expand", "Comma-separated relations to include, such as issue_relation and issue_related"
)
UPDATED_AFTER_PARAMETER = _query(
    "updated_at__gt", "Only work items updated after this time", type=OpenApiTypes.DATETIME
)

# The legacy filters of issue_filters(). The group filters of a grouped list use them.
LEGACY_FILTER_PARAMETERS = [
    _id_list("state", "state"),
    _query("state_group", "Comma-separated state groups"),
    _query("priority", "Comma-separated priorities"),
    _id_list("labels", "label"),
    _id_list("assignees", "user"),
    _id_list("mentions", "user"),
    _id_list("created_by", "user"),
    _id_list("subscriber", "user"),
    _id_list("cycle", "cycle"),
    _id_list("module", "module"),
    _id_list("project", "project"),
    _id_list("parent", "work item"),
    _query("start_date", "Comma-separated date filters such as 2026-01-01;after"),
    _query("target_date", "Comma-separated date filters such as 2026-01-01;after,2026-02-01;before"),
]

ISSUE_LIST_PARAMETERS = [
    CURSOR_PARAMETER,
    PER_PAGE_PARAMETER,
    LIST_GROUP_BY_PARAMETER,
    LIST_SUB_GROUP_BY_PARAMETER,
    ORDER_BY_PARAMETER,
    SUB_ISSUE_PARAMETER,
    FILTERS_PARAMETER,
    PQL_PARAMETER,
    LAYOUT_PARAMETER,
    UPDATED_AFTER_PARAMETER,
    *LEGACY_FILTER_PARAMETERS,
]

# The list endpoints without PQL and updated_at__gt: archived and profile work items.
GROUPED_ISSUE_LIST_PARAMETERS = [
    CURSOR_PARAMETER,
    PER_PAGE_PARAMETER,
    LIST_GROUP_BY_PARAMETER,
    LIST_SUB_GROUP_BY_PARAMETER,
    ORDER_BY_PARAMETER,
    SUB_ISSUE_PARAMETER,
    FILTERS_PARAMETER,
    LAYOUT_PARAMETER,
    *LEGACY_FILTER_PARAMETERS,
]

DRAFT_LIST_PARAMETERS = [CURSOR_PARAMETER, PER_PAGE_PARAMETER, *LEGACY_FILTER_PARAMETERS]

ISSUE_DETAIL_LIST_PARAMETERS = [
    CURSOR_PARAMETER,
    PER_PAGE_PARAMETER,
    ORDER_BY_PARAMETER,
    FILTERS_PARAMETER,
    LAYOUT_PARAMETER,
    EXPAND_ISSUE_PARAMETER,
    *LEGACY_FILTER_PARAMETERS,
]

ISSUE_IDS_PARAMETER = OpenApiParameter(
    name="issues",
    description="Comma-separated work item ids, a 400 when missing",
    required=True,
    type=OpenApiTypes.STR,
    location=OpenApiParameter.QUERY,
)

ISSUE_IDS_ROLLUP_PARAMETER = _query("issue_ids", "Comma-separated work item ids")

DESCRIPTION_PARAMETER = _query("description", "Include description_html. False when omitted", type=OpenApiTypes.BOOL)

SHOW_SUB_ISSUES_PARAMETER = _query(
    "show_sub_issues", "Include archived work items that have a parent. True when omitted", type=OpenApiTypes.BOOL
)

ACTIVITY_PROJECT_PARAMETER = OpenApiParameter(
    name="project",
    description="Only activity in these projects. Repeat the parameter for more than one",
    type={"type": "array", "items": {"type": "string", "format": "uuid"}},
    location=OpenApiParameter.QUERY,
    required=False,
    explode=True,
)

RELATION_TYPES = (
    "blocking",
    "blocked_by",
    "duplicate",
    "relates_to",
    "start_before",
    "start_after",
    "finish_before",
    "finish_after",
    "implemented_by",
    "implements",
)


class IssueUpdateSerializer(IssueCreateSerializer):
    skip_activity = serializers.BooleanField(
        required=False, write_only=True, help_text="With description_html, store the change without an activity"
    )


class IssueIdsSerializer(serializers.Serializer):
    issue_ids = serializers.ListField(child=serializers.UUIDField())


class IssueDateUpdateSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    start_date = serializers.DateField(required=False, allow_null=True)
    target_date = serializers.DateField(required=False, allow_null=True)


class IssueDatesUpdateSerializer(serializers.Serializer):
    updates = IssueDateUpdateSerializer(many=True)


class SubIssuesAddSerializer(serializers.Serializer):
    sub_issue_ids = serializers.ListField(child=serializers.UUIDField())


class IssueRelationCreateSerializer(serializers.Serializer):
    relation_type = serializers.ChoiceField(choices=RELATION_TYPES)
    issues = serializers.ListField(child=serializers.UUIDField(), help_text="Work items of the same workspace")


class IssueRelationRemoveSerializer(serializers.Serializer):
    related_issue = serializers.UUIDField()
    relation_type = serializers.ChoiceField(choices=RELATION_TYPES, help_text="Named in the activity of both items")


class DraftIssueWriteSerializer(DraftIssueCreateSerializer):
    project_id = serializers.UUIDField(
        required=False, allow_null=True, help_text="On update, the draft's own project or a 400"
    )
    cycle_id = serializers.UUIDField(required=False, allow_null=True, help_text="A cycle of the project")
    module_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, help_text="Modules of the project"
    )


class DraftToIssueSerializer(IssueCreateSerializer):
    cycle_id = serializers.UUIDField(required=False, allow_null=True, help_text="A cycle of the draft's project")
    module_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, help_text="Modules of the draft's project"
    )
