# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.app.serializers.request.issue import LAYOUT_PARAMETER, LEGACY_FILTER_PARAMETERS, SUB_ISSUE_PARAMETER
from plane.utils.openapi.parameters import (
    CURSOR_PARAMETER,
    FILTERS_PARAMETER,
    ORDER_BY_PARAMETER,
    PER_PAGE_PARAMETER,
    PQL_PARAMETER,
)

# The work items of a workspace view. The list is not grouped.
WORKSPACE_ISSUE_LIST_PARAMETERS = [
    CURSOR_PARAMETER,
    PER_PAGE_PARAMETER,
    ORDER_BY_PARAMETER,
    SUB_ISSUE_PARAMETER,
    FILTERS_PARAMETER,
    PQL_PARAMETER,
    LAYOUT_PARAMETER,
    *LEGACY_FILTER_PARAMETERS,
]


class ViewFavoriteSerializer(serializers.Serializer):
    view = serializers.UUIDField()
