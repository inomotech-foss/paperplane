# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers

from plane.app.serializers.page import PageSerializer
from plane.db.models import Page


def _query(name, description, type=OpenApiTypes.STR, enum=None):
    return OpenApiParameter(
        name=name, description=description, type=type, location=OpenApiParameter.QUERY, required=False, enum=enum
    )


TRACK_VISIT_PARAMETER = _query(
    "track_visit", "Record the read as a recent visit. True when omitted", type=OpenApiTypes.BOOL
)

PAGE_QUERY_KINDS = (
    "tree",
    "index",
    "recent",
    "search",
    "contributors",
    "by-label",
    "label-list",
    "page-properties",
    "task-report",
    "decision-report",
)

PAGE_QUERY_PARAMETERS = [
    _query("kind", "The query to run. recent when omitted", enum=PAGE_QUERY_KINDS),
    _query("scope", "project limits the pages to project_id. The whole workspace when omitted", enum=("project",)),
    _query("project_id", "The project of scope=project", type=OpenApiTypes.UUID),
    _query("root_page_id", "The page whose descendants tree and the reports list", type=OpenApiTypes.UUID),
    _query("depth", "Levels below root_page_id for tree, 1 to 20. 1 when omitted", type=OpenApiTypes.INT),
    _query("limit", "Rows to return, 1 to 100. 20 when omitted", type=OpenApiTypes.INT),
    _query("sort", "The order of the pages", enum=("title", "modified", "created")),
    _query("reverse", "Reverse the order", type=OpenApiTypes.BOOL),
    _query("search", "The text a page name contains, for search"),
    _query("labels", "Comma-separated label names, for by-label, page-properties and the reports"),
    _query("columns", "Comma-separated property names, for page-properties"),
    _query("status", "Only complete or incomplete tasks, for task-report", enum=("complete", "incomplete")),
]


class PageCreateSerializer(PageSerializer):
    description_html = serializers.CharField(required=False, help_text="<p></p> when omitted")
    description_json = serializers.JSONField(required=False, help_text="The editor document of description_html")

    class Meta(PageSerializer.Meta):
        fields = [*PageSerializer.Meta.fields, "description_html", "description_json"]


class PageAccessSerializer(serializers.Serializer):
    access = serializers.ChoiceField(choices=Page.ACCESS_CHOICES, required=False, help_text="Public when omitted")
