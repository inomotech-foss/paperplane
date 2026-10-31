# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.plumbing import build_array_type, build_basic_type, build_object_type
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import PolymorphicProxySerializer
from rest_framework import serializers

from plane.app.serializers import (
    IssueActivitySerializer,
    IssueCommentSerializer,
    IssueCreateSerializer,
    IssueSerializer,
)
from plane.utils.openapi.pagination import paginated_union


class WorkItemValuesSerializer(serializers.Serializer):
    """The issue columns the list endpoints read with values()."""

    id = serializers.UUIDField()
    name = serializers.CharField()
    state_id = serializers.UUIDField(allow_null=True)
    sort_order = serializers.FloatField()
    completed_at = serializers.DateTimeField(allow_null=True)
    estimate_point = serializers.UUIDField(allow_null=True)
    priority = serializers.CharField()
    start_date = serializers.DateField(allow_null=True)
    target_date = serializers.DateField(allow_null=True)
    sequence_id = serializers.IntegerField()
    project_id = serializers.UUIDField()
    parent_id = serializers.UUIDField(allow_null=True)
    type_id = serializers.UUIDField()
    cycle_id = serializers.UUIDField(allow_null=True)
    module_ids = serializers.ListField(child=serializers.UUIDField())
    label_ids = serializers.ListField(child=serializers.UUIDField())
    assignee_ids = serializers.ListField(child=serializers.UUIDField())
    sub_issues_count = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    created_by = serializers.UUIDField(allow_null=True)
    updated_by = serializers.UUIDField(allow_null=True)
    attachment_count = serializers.IntegerField()
    link_count = serializers.IntegerField()
    is_draft = serializers.BooleanField()
    archived_at = serializers.DateTimeField(allow_null=True)


class WorkItemSnapshotSerializer(WorkItemValuesSerializer):
    deleted_at = serializers.DateTimeField(allow_null=True)
    sub_issues_count = serializers.IntegerField(allow_null=True)
    attachment_count = serializers.IntegerField(allow_null=True)
    link_count = serializers.IntegerField(allow_null=True)


class ViewWorkItemSerializer(WorkItemValuesSerializer):
    """What ViewIssueListSerializer emits: no type_id."""

    type_id = None
    state__group = serializers.CharField(allow_null=True)


class WorkItemListItemSerializer(WorkItemValuesSerializer):
    """A row of a grouped list. Grouping by labels, assignees or modules swaps the id list for the group key."""

    state__group = serializers.CharField(allow_null=True)
    sub_issues_count = serializers.IntegerField(allow_null=True)
    attachment_count = serializers.IntegerField(allow_null=True)
    link_count = serializers.IntegerField(allow_null=True)
    labels__id = serializers.UUIDField(allow_null=True)
    assignees__id = serializers.UUIDField(allow_null=True)
    issue_module__module_id = serializers.UUIDField(allow_null=True)

    class Meta:
        response_optional = (
            "module_ids",
            "label_ids",
            "assignee_ids",
            "labels__id",
            "assignees__id",
            "issue_module__module_id",
        )


WorkItemListResponse = paginated_union(WorkItemListItemSerializer, name="WorkItem")


class WorkItemSyncItemSerializer(WorkItemValuesSerializer):
    state__group = serializers.CharField(allow_null=True)
    sub_issues_count = serializers.IntegerField(allow_null=True)
    attachment_count = serializers.IntegerField(allow_null=True)
    link_count = serializers.IntegerField(allow_null=True)
    description_html = serializers.CharField(required=False, help_text="Present when description=true")


WorkItemsByIdResponse = PolymorphicProxySerializer(
    component_name="WorkItemsByIdResponse",
    serializers=[WorkItemSnapshotSerializer(many=True), IssueSerializer(many=True)],
    resource_type_field_name=None,
    many=False,
    help_text="Full issues when fields or expand is given",
)


class WorkItemMetaSerializer(serializers.Serializer):
    sequence_id = serializers.IntegerField()
    project_identifier = serializers.CharField()


WorkItemHistoryEntry = PolymorphicProxySerializer(
    component_name="WorkItemHistoryEntry",
    serializers=[IssueActivitySerializer, IssueCommentSerializer],
    resource_type_field_name=None,
    many=True,
)


class ArchivedAtSerializer(serializers.Serializer):
    archived_at = serializers.CharField()


class SubscriptionStatusSerializer(serializers.Serializer):
    subscribed = serializers.BooleanField()


class DateRollupSerializer(serializers.Serializer):
    start_date = serializers.DateField(allow_null=True)
    target_date = serializers.DateField(allow_null=True)
    children_count = serializers.IntegerField()
    descendants_count = serializers.IntegerField()


class RelatedWorkItemSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    state_id = serializers.UUIDField(allow_null=True)
    sort_order = serializers.FloatField()
    priority = serializers.CharField()
    sequence_id = serializers.IntegerField()
    project_id = serializers.UUIDField()
    type_id = serializers.UUIDField()
    label_ids = serializers.ListField(child=serializers.UUIDField())
    assignee_ids = serializers.ListField(child=serializers.UUIDField())
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    created_by = serializers.UUIDField(allow_null=True)
    updated_by = serializers.UUIDField(allow_null=True)
    relation_type = serializers.CharField()


class WorkItemRelationsSerializer(serializers.Serializer):
    blocking = RelatedWorkItemSerializer(many=True)
    blocked_by = RelatedWorkItemSerializer(many=True)
    duplicate = RelatedWorkItemSerializer(many=True)
    relates_to = RelatedWorkItemSerializer(many=True)
    start_after = RelatedWorkItemSerializer(many=True)
    start_before = RelatedWorkItemSerializer(many=True)
    finish_after = RelatedWorkItemSerializer(many=True)
    finish_before = RelatedWorkItemSerializer(many=True)


class SubWorkItemSerializer(WorkItemValuesSerializer):
    state_group = serializers.CharField(allow_null=True)


STATE_DISTRIBUTION = serializers.DictField(
    child=serializers.ListField(child=serializers.UUIDField()), help_text="Sub work item ids by state group"
)


class SubWorkItemListSerializer(serializers.Serializer):
    sub_issues = SubWorkItemSerializer(many=True)
    state_distribution = STATE_DISTRIBUTION


class GroupedSubWorkItemListSerializer(serializers.Serializer):
    sub_issues = serializers.DictField(
        child=serializers.ListField(child=SubWorkItemSerializer()), help_text="Sub work items by group value"
    )
    state_distribution = STATE_DISTRIBUTION


# A top level proxy: DRF drops many=False when a proxy is nested as a field.
SubWorkItemsResponse = PolymorphicProxySerializer(
    component_name="SubWorkItemsResponse",
    serializers=[SubWorkItemListSerializer, GroupedSubWorkItemListSerializer],
    resource_type_field_name=None,
    many=False,
    help_text="Grouped when group_by is given",
)


class AddedSubWorkItemsSerializer(serializers.Serializer):
    sub_issues = IssueSerializer(many=True)
    state_distribution = STATE_DISTRIBUTION


class VersionRowSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    workspace = serializers.UUIDField()
    project = serializers.UUIDField()
    issue = serializers.UUIDField()
    last_saved_at = serializers.DateTimeField()
    owned_by = serializers.UUIDField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    created_by = serializers.UUIDField(allow_null=True)
    updated_by = serializers.UUIDField(allow_null=True)


class PropertyValuesSerializer(serializers.Serializer):
    values = serializers.DictField(child=serializers.JSONField(), help_text="Value or values by property id")
    display = serializers.DictField(child=serializers.JSONField(), help_text="Display text by property id")
    derived = serializers.DictField(
        child=serializers.DictField(child=serializers.UUIDField(allow_null=True)),
        help_text="source_issue_id by property id for derived values",
    )


class QueryValidationSerializer(serializers.Serializer):
    valid = serializers.BooleanField()
    expression = serializers.JSONField(help_text="Filters AST when valid")
    error = serializers.CharField()
    position = serializers.IntegerField(allow_null=True)
    line = serializers.IntegerField(allow_null=True)
    column = serializers.IntegerField(allow_null=True)
    token = serializers.CharField(allow_null=True)
    expected = serializers.JSONField(allow_null=True)
    field = serializers.CharField(allow_null=True)
    lookup = serializers.CharField(allow_null=True)

    class Meta:
        response_optional = (
            "expression",
            "error",
            "position",
            "line",
            "column",
            "token",
            "expected",
            "field",
            "lookup",
        )


def _strings():
    return build_array_type(build_basic_type(OpenApiTypes.STR))


# A raw schema: a serializer cannot declare a field called "fields".
QUERY_VOCABULARY_SCHEMA = build_object_type(
    properties={
        "fields": build_array_type(
            build_object_type(
                properties={
                    "name": build_basic_type(OpenApiTypes.STR),
                    "type": build_basic_type(OpenApiTypes.STR),
                    "lookups": _strings(),
                    "operators": _strings(),
                    "people": build_basic_type(OpenApiTypes.BOOL),
                    "choices": {**_strings(), "nullable": True},
                    "aliases": _strings(),
                    "plane_aliases": _strings(),
                },
                required=["name", "type", "lookups", "operators", "people", "choices", "aliases", "plane_aliases"],
            )
        ),
        "unsupported": build_object_type(
            additionalProperties=build_basic_type(OpenApiTypes.STR), description="Reason by field name"
        ),
        "functions": build_array_type(
            build_object_type(
                properties={
                    "name": build_basic_type(OpenApiTypes.STR),
                    "kind": build_basic_type(OpenApiTypes.STR),
                    "arguments": build_basic_type(OpenApiTypes.INT),
                },
                required=["name", "kind", "arguments"],
            )
        ),
        "custom_property_syntax": build_basic_type(OpenApiTypes.STR),
    },
    required=["fields", "unsupported", "functions", "custom_property_syntax"],
)


class DraftWorkItemSnapshotSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField(allow_null=True)
    state_id = serializers.UUIDField(allow_null=True)
    sort_order = serializers.FloatField()
    completed_at = serializers.DateTimeField(allow_null=True)
    estimate_point = serializers.UUIDField(allow_null=True)
    priority = serializers.CharField()
    start_date = serializers.DateField(allow_null=True)
    target_date = serializers.DateField(allow_null=True)
    project_id = serializers.UUIDField(allow_null=True)
    parent_id = serializers.UUIDField(allow_null=True)
    cycle_id = serializers.UUIDField(allow_null=True)
    module_ids = serializers.ListField(child=serializers.UUIDField())
    label_ids = serializers.ListField(child=serializers.UUIDField())
    assignee_ids = serializers.ListField(child=serializers.UUIDField())
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    created_by = serializers.UUIDField(allow_null=True)
    updated_by = serializers.UUIDField(allow_null=True)
    type_id = serializers.UUIDField(allow_null=True)
    description_html = serializers.CharField()


class WorkItemSearchResultSerializer(serializers.Serializer):
    name = serializers.CharField()
    id = serializers.UUIDField()
    start_date = serializers.DateField(allow_null=True)
    sequence_id = serializers.IntegerField()
    project__name = serializers.CharField()
    project__identifier = serializers.CharField()
    project_id = serializers.UUIDField()
    workspace__slug = serializers.CharField()
    state__name = serializers.CharField(allow_null=True)
    state__group = serializers.CharField(allow_null=True)
    state__color = serializers.CharField(allow_null=True)
    type_id = serializers.UUIDField()


class ExpandedRelationSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    project_id = serializers.UUIDField()
    sequence_id = serializers.IntegerField()
    name = serializers.CharField()
    relation_type = serializers.CharField()
    state_id = serializers.UUIDField(allow_null=True)
    priority = serializers.CharField()
    created_by = serializers.UUIDField(allow_null=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    updated_by = serializers.UUIDField(allow_null=True)


class WorkItemDetailRowSerializer(WorkItemValuesSerializer):
    """What IssueListDetailSerializer emits."""

    issue_relation = ExpandedRelationSerializer(many=True, help_text="Present with expand=issue_relation")
    issue_related = ExpandedRelationSerializer(many=True, help_text="Present with expand=issue_related")

    class Meta:
        response_optional = ("issue_relation", "issue_related")


class CreatedWorkItemSerializer(IssueCreateSerializer):
    """IssueCreateSerializer output, which echoes the requested assignee and label ids."""

    label_ids = serializers.ListField(child=serializers.UUIDField())
    assignee_ids = serializers.ListField(child=serializers.UUIDField())
