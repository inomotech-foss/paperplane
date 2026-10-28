# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.utils import OpenApiResponse
from rest_framework import status
from rest_framework.response import Response

from plane.api.serializers import DeletedWorkItemSerializer
from plane.app.permissions import ROLE, ProjectEntityPermission, allow_permission
from plane.utils.openapi import (
    CURSOR_PARAMETER,
    PER_PAGE_PARAMETER,
    create_paginated_response,
    work_item_docs,
)
from plane.utils.work_item_trash import listed_trashed_issues, restore_work_item, trashed_issues

from .base import BaseAPIView


class DeletedWorkItemListAPIEndpoint(BaseAPIView):
    """Deleted work items of a project that can still be restored."""

    permission_classes = [ProjectEntityPermission]

    @work_item_docs(
        operation_id="list_deleted_work_items",
        summary="List deleted work items",
        description=(
            "Retrieve the deleted work items of a project, newest first. Sub-items deleted along with their "
            "parent are not listed, because restoring the parent restores them. Project members and admins only."
        ),
        parameters=[CURSOR_PARAMETER, PER_PAGE_PARAMETER],
        responses={
            200: create_paginated_response(
                DeletedWorkItemSerializer,
                "PaginatedDeletedWorkItemResponse",
                "Paginated list of deleted work items",
                "Paginated Deleted Work Items",
            ),
        },
    )
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def get(self, request, slug, project_id):
        """List deleted work items"""
        return self.paginate(
            request=request,
            queryset=listed_trashed_issues(slug, project_id),
            on_results=lambda issues: DeletedWorkItemSerializer(issues, many=True).data,
            default_per_page=20,
            max_per_page=100,
        )


class DeletedWorkItemRestoreAPIEndpoint(BaseAPIView):
    """Restore one deleted work item."""

    permission_classes = [ProjectEntityPermission]

    @work_item_docs(
        operation_id="restore_deleted_work_item",
        summary="Restore deleted work item",
        description=(
            "Restore a deleted work item together with everything its deletion removed, such as sub-items, "
            "comments and labels. Project members and admins only."
        ),
        request=None,
        responses={
            204: OpenApiResponse(description="Work item restored"),
            409: OpenApiResponse(
                description=(
                    "The work item cannot be restored: its work item type was deleted, or another work item "
                    'now has its number. The body is {"error": "<reason>"}.'
                ),
            ),
        },
    )
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id, issue_id):
        """Restore deleted work item"""
        issue = trashed_issues(slug, project_id).get(pk=issue_id)
        error = restore_work_item(issue, request.user.id)
        if error:
            return Response({"error": error}, status=status.HTTP_409_CONFLICT)
        return Response(status=status.HTTP_204_NO_CONTENT)
