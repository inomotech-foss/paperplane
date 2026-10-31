# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers

from plane.app.serializers.request.issue import (
    LAYOUT_PARAMETER,
    LEGACY_FILTER_PARAMETERS,
    LIST_GROUP_BY_PARAMETER,
    LIST_SUB_GROUP_BY_PARAMETER,
    SUB_ISSUE_PARAMETER,
)
from plane.utils.openapi.fields import ClientJsonField
from plane.utils.openapi.parameters import (
    CURSOR_PARAMETER,
    FILTERS_PARAMETER,
    ORDER_BY_PARAMETER,
    PER_PAGE_PARAMETER,
    PQL_PARAMETER,
)

CYCLE_VIEW_PARAMETER = OpenApiParameter(
    name="cycle_view",
    description="current lists only the running cycle. All cycles when omitted",
    type=OpenApiTypes.STR,
    location=OpenApiParameter.QUERY,
    required=False,
    enum=("all", "current"),
)

ANALYTICS_TYPE_PARAMETER = OpenApiParameter(
    name="type",
    description="Count work items or sum estimate points. issues when omitted",
    type=OpenApiTypes.STR,
    location=OpenApiParameter.QUERY,
    required=False,
    enum=("issues", "points"),
)

# The work item lists of a cycle or a module.
SCOPED_ISSUE_LIST_PARAMETERS = [
    CURSOR_PARAMETER,
    PER_PAGE_PARAMETER,
    LIST_GROUP_BY_PARAMETER,
    LIST_SUB_GROUP_BY_PARAMETER,
    ORDER_BY_PARAMETER,
    SUB_ISSUE_PARAMETER,
    FILTERS_PARAMETER,
    PQL_PARAMETER,
    LAYOUT_PARAMETER,
    *LEGACY_FILTER_PARAMETERS,
]


class CycleDateCheckRequestSerializer(serializers.Serializer):
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    cycle_id = serializers.UUIDField(required=False, help_text="The cycle being edited, which may overlap itself")


class CycleFavoriteSerializer(serializers.Serializer):
    cycle = serializers.UUIDField()


class CycleTransferSerializer(serializers.Serializer):
    new_cycle_id = serializers.UUIDField(help_text="An active or upcoming cycle of the project")


class CycleIssuesAddSerializer(serializers.Serializer):
    issues = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        help_text="Work items of the project. Moves them out of their current cycle",
    )


class IssueFiltersUpdateSerializer(serializers.Serializer):
    """The filters a member keeps for a cycle or a module. Omitted keys keep their value."""

    filters = ClientJsonField(required=False)
    rich_filters = ClientJsonField(required=False)
    display_filters = ClientJsonField(required=False)
    display_properties = ClientJsonField(required=False)
