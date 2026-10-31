# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter

from plane.utils.build_chart import x_axis_mapper


def _query(name, description, enum=None, type=OpenApiTypes.STR):
    return OpenApiParameter(
        name=name, description=description, type=type, location=OpenApiParameter.QUERY, required=False, enum=enum
    )


DATE_FILTER_PARAMETER = _query(
    "date_filter",
    "Limit the counts to a period. Every work item when omitted",
    enum=("yesterday", "last_7_days", "last_30_days", "last_3_months"),
)
PROJECT_IDS_PARAMETER = _query("project_ids", "Comma-separated project ids. Every project of the user when omitted")
CYCLE_ID_PARAMETER = _query("cycle_id", "Only the work items of this cycle", type=OpenApiTypes.UUID)
MODULE_ID_PARAMETER = _query("module_id", "Only the work items of this module", type=OpenApiTypes.UUID)
CHART_AXES = tuple(x_axis_mapper)
X_AXIS_PARAMETER = _query("x_axis", "The axis of a custom-work-items chart. PRIORITY when omitted", enum=CHART_AXES)
GROUP_BY_PARAMETER = _query("group_by", "Split each bar of a custom-work-items chart by this field", enum=CHART_AXES)

ANALYTICS_FILTER_PARAMETERS = [DATE_FILTER_PARAMETER, PROJECT_IDS_PARAMETER]
PROJECT_ANALYTICS_FILTER_PARAMETERS = [*ANALYTICS_FILTER_PARAMETERS, CYCLE_ID_PARAMETER, MODULE_ID_PARAMETER]

WORKSPACE_COUNTS_PARAMETERS = [
    _query("tab", "Which counts to return. overview when omitted", enum=("overview", "work-items")),
    *ANALYTICS_FILTER_PARAMETERS,
]
STATS_TYPE_PARAMETER = _query("type", "The only supported value. work-items when omitted", enum=("work-items",))
WORKSPACE_CHART_PARAMETERS = [
    _query("type", "The chart. projects when omitted", enum=("projects", "work-items", "custom-work-items")),
    X_AXIS_PARAMETER,
    GROUP_BY_PARAMETER,
    *ANALYTICS_FILTER_PARAMETERS,
]
PROJECT_CHART_PARAMETERS = [
    _query("type", "The chart", enum=("work-items", "custom-work-items")),
    X_AXIS_PARAMETER,
    GROUP_BY_PARAMETER,
    *PROJECT_ANALYTICS_FILTER_PARAMETERS,
]
