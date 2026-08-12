# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

from django.core.serializers.json import DjangoJSONEncoder
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse
from rest_framework import status
from rest_framework.response import Response

from plane.api.serializers import IssueSerializer
from plane.app.permissions import ProjectEntityPermission
from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import Issue
from plane.utils.host import base_host
from plane.utils.openapi import (
    CURSOR_PARAMETER,
    EXPAND_PARAMETER,
    FIELDS_PARAMETER,
    INVALID_REQUEST_RESPONSE,
    ORDER_BY_PARAMETER,
    PER_PAGE_PARAMETER,
    create_paginated_response,
    work_item_docs,
)

from .base import BaseAPIView

# A work item is only archivable once it is out of play.
ARCHIVABLE_STATE_GROUPS = ["completed", "cancelled"]


class WorkItemArchiveListAPIEndpoint(BaseAPIView):
    """Archived work items of a project."""

    serializer_class = IssueSerializer
    model = Issue
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            Issue.objects.filter(
                workspace__slug=self.kwargs.get("slug"),
                project_id=self.kwargs.get("project_id"),
                archived_at__isnull=False,
            )
            .filter(project__project_projectmember__member=self.request.user)
            .filter(project__project_projectmember__is_active=True)
            .select_related("workspace", "project", "state", "parent")
            .prefetch_related("assignees", "labels", "issue_module__module")
            .order_by(self.kwargs.get("order_by", "-created_at"))
        )

    @work_item_docs(
        operation_id="list_archived_work_items",
        summary="List archived work items",
        description="Retrieve the work items that have been archived in a project.",
        parameters=[
            CURSOR_PARAMETER,
            PER_PAGE_PARAMETER,
            ORDER_BY_PARAMETER,
            FIELDS_PARAMETER,
            EXPAND_PARAMETER,
        ],
        responses={
            200: create_paginated_response(
                IssueSerializer,
                "PaginatedArchivedWorkItemResponse",
                "Paginated list of archived work items",
                "Paginated Archived Work Items",
            ),
        },
    )
    def get(self, request, slug, project_id):
        """List archived work items"""
        return self.paginate(
            request=request,
            queryset=self.get_queryset(),
            on_results=lambda issues: IssueSerializer(issues, many=True, fields=self.fields, expand=self.expand).data,
        )


class WorkItemArchiveAPIEndpoint(BaseAPIView):
    """Archive and restore one work item."""

    serializer_class = IssueSerializer
    model = Issue
    permission_classes = [ProjectEntityPermission]

    def record(self, request, issue, project_id, archived_at):
        issue_activity.delay(
            type="issue.activity.updated",
            requested_data=json.dumps({"archived_at": archived_at, "automation": False}),
            actor_id=str(request.user.id),
            issue_id=str(issue.id),
            project_id=str(project_id),
            current_instance=json.dumps(IssueSerializer(issue).data, cls=DjangoJSONEncoder),
            epoch=int(timezone.now().timestamp()),
            notification=True,
            origin=base_host(request=request, is_app=True),
        )

    @work_item_docs(
        operation_id="archive_work_item",
        summary="Archive work item",
        description="Archive a work item. Only work items in a completed or cancelled state can be archived.",
        responses={
            200: OpenApiResponse(description="Work item archived"),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def post(self, request, slug, project_id, issue_id):
        """Archive work item"""
        issue = Issue.issue_objects.get(workspace__slug=slug, project_id=project_id, pk=issue_id)
        if issue.state.group not in ARCHIVABLE_STATE_GROUPS:
            return Response(
                {"error": "Only a completed or cancelled work item can be archived"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self.record(request, issue, project_id, str(timezone.now().date()))
        issue.archived_at = timezone.now().date()
        issue.save()
        return Response({"archived_at": str(issue.archived_at)}, status=status.HTTP_200_OK)


class WorkItemUnarchiveAPIEndpoint(WorkItemArchiveAPIEndpoint):
    """Restore an archived work item."""

    @work_item_docs(
        operation_id="unarchive_work_item",
        summary="Unarchive work item",
        description="Restore an archived work item.",
        responses={200: OpenApiResponse(description="Work item unarchived")},
    )
    def post(self, request, slug, project_id, issue_id):
        """Unarchive work item"""
        issue = Issue.objects.get(
            workspace__slug=slug,
            project_id=project_id,
            archived_at__isnull=False,
            pk=issue_id,
        )
        self.record(request, issue, project_id, None)
        issue.archived_at = None
        issue.save()
        return Response(status=status.HTTP_200_OK)
