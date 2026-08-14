# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Workspace wide work item list and count endpoints."""

from django.db.models import Count, F, Func, OuterRef
from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.response import Response

from plane.api.serializers import IssueSerializer
from plane.app.permissions import WorkspaceEntityPermission
from plane.db.models import Issue
from plane.utils.openapi import (
    CURSOR_PARAMETER,
    EXPAND_PARAMETER,
    FIELDS_PARAMETER,
    FILTERS_PARAMETER,
    GROUP_BY_PARAMETER,
    ORDER_BY_PARAMETER,
    PER_PAGE_PARAMETER,
    PQL_PARAMETER,
    SUB_GROUP_BY_PARAMETER,
    UNAUTHORIZED_RESPONSE,
    FORBIDDEN_RESPONSE,
    INVALID_REQUEST_RESPONSE,
    WORKSPACE_SLUG_PARAMETER,
    create_paginated_response,
)
from plane.utils.order_queryset import ISSUE_ORDER_BY_ALLOWLIST, sanitize_order_by
from plane.utils.pql import WorkItemFilterError, resolve_group_by

from .base import BaseAPIView
from .work_item_filter import WorkItemFilterMixin, workspace_work_items

COUNT_EXAMPLE = OpenApiExample(
    name="Grouped Work Item Count",
    value={
        "grouped_by": "priority",
        "sub_grouped_by": None,
        "total_count": 3,
        "grouped_counts": {"urgent": {"count": 1}, "None": {"count": 2}},
    },
)


class WorkspaceWorkItemListAPIEndpoint(WorkItemFilterMixin, BaseAPIView):
    """Work items across every project of a workspace the caller belongs to."""

    model = Issue
    serializer_class = IssueSerializer
    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            workspace_work_items(self.request.user, self.kwargs.get("slug"))
            .annotate(
                sub_issues_count=Issue.issue_objects.filter(parent=OuterRef("id"))
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .select_related("workspace", "project", "state", "parent")
            .prefetch_related("assignees", "labels")
        )

    @extend_schema(
        operation_id="list_workspace_work_items",
        summary="List workspace work items",
        description="Retrieve a paginated list of the work items the caller can see across a whole workspace.",
        tags=["Work Items"],
        parameters=[
            WORKSPACE_SLUG_PARAMETER,
            PQL_PARAMETER,
            FILTERS_PARAMETER,
            CURSOR_PARAMETER,
            PER_PAGE_PARAMETER,
            ORDER_BY_PARAMETER,
            FIELDS_PARAMETER,
            EXPAND_PARAMETER,
        ],
        responses={
            200: create_paginated_response(
                IssueSerializer,
                "PaginatedWorkspaceWorkItemResponse",
                "Paginated list of workspace work items",
                "Paginated Workspace Work Items",
            ),
            400: INVALID_REQUEST_RESPONSE,
            401: UNAUTHORIZED_RESPONSE,
            403: FORBIDDEN_RESPONSE,
        },
    )
    def get(self, request, slug):
        """List workspace work items"""
        order_by = sanitize_order_by(
            request.GET.get("order_by", "-created_at"), ISSUE_ORDER_BY_ALLOWLIST, "-created_at"
        )
        querysets, error = self.filter_work_items(request, slug, [self.get_queryset()])
        if error:
            return error
        return self.paginate(
            request=request,
            queryset=querysets[0].order_by(order_by),
            on_results=lambda issues: IssueSerializer(issues, many=True, fields=self.fields, expand=self.expand).data,
        )


class WorkspaceWorkItemCountAPIEndpoint(WorkItemFilterMixin, BaseAPIView):
    """Counts of the work items a caller can see across a whole workspace."""

    model = Issue
    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    @extend_schema(
        operation_id="count_workspace_work_items",
        summary="Count workspace work items",
        description="Count the work items the caller can see across a whole workspace, optionally grouped.",
        tags=["Work Items"],
        parameters=[
            WORKSPACE_SLUG_PARAMETER,
            PQL_PARAMETER,
            FILTERS_PARAMETER,
            GROUP_BY_PARAMETER,
            SUB_GROUP_BY_PARAMETER,
        ],
        responses={
            200: OpenApiResponse(description="Work item counts", examples=[COUNT_EXAMPLE]),
            400: INVALID_REQUEST_RESPONSE,
            401: UNAUTHORIZED_RESPONSE,
            403: FORBIDDEN_RESPONSE,
        },
    )
    def get(self, request, slug):
        """Count workspace work items"""
        group_by = request.GET.get("group_by") or None
        sub_group_by = request.GET.get("sub_group_by") or None
        if sub_group_by and not group_by:
            return Response(
                {"error": "'sub_group_by' is only supported together with 'group_by'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            group = resolve_group_by(group_by, "group_by") if group_by else None
            sub_group = resolve_group_by(sub_group_by, "sub_group_by") if sub_group_by else None
        except WorkItemFilterError as exc:
            return Response(exc.payload, status=status.HTTP_400_BAD_REQUEST)

        querysets, error = self.filter_work_items(request, slug, [workspace_work_items(request.user, slug)])
        if error:
            return error
        queryset = querysets[0]

        payload = {
            "grouped_by": group[0] if group else None,
            "sub_grouped_by": sub_group[0] if sub_group else None,
            "total_count": queryset.distinct().count(),
            "grouped_counts": _grouped_counts(queryset, group, sub_group),
        }
        return Response(payload, status=status.HTTP_200_OK)


def _grouped_counts(queryset, group, sub_group):
    if group is None:
        return {}
    group_path = group[1].path
    grouped = {
        _group_key(row[group_path]): {"count": row["count"]} for row in _count_rows(queryset, [group], group_path)
    }
    if sub_group is None:
        return grouped

    sub_path = sub_group[1].path
    for row in _count_rows(queryset, [group, sub_group], group_path, sub_path):
        entry = grouped.setdefault(_group_key(row[group_path]), {"count": 0})
        entry.setdefault("sub_grouped_counts", {})[_group_key(row[sub_path])] = {"count": row["count"]}
    for entry in grouped.values():
        entry.setdefault("sub_grouped_counts", {})
    return grouped


def _count_rows(queryset, fields, *paths):
    """Count distinct work items per combination of the given field paths."""
    for _, field in fields:
        for guard_key, guard_value in field.join_guard:
            queryset = queryset.filter(**{guard_key: guard_value})
    return queryset.values(*paths).annotate(count=Count("id", distinct=True)).order_by()


def _group_key(value):
    return "None" if value is None else str(value)
