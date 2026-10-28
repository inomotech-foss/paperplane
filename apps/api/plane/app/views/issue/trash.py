# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import TrashedIssueSerializer
from plane.bgtasks.deletion_task import purge_issues
from plane.utils.openapi import CURSOR_PARAMETER, PER_PAGE_PARAMETER
from plane.utils.openapi.pagination import paginated_response
from plane.utils.work_item_trash import listed_trashed_issues, restore_work_item, trashed_issues

from .. import BaseAPIView


class IssueTrashEndpoint(BaseAPIView):
    @extend_schema(
        parameters=[CURSOR_PARAMETER, PER_PAGE_PARAMETER],
        responses={200: paginated_response(TrashedIssueSerializer)},
    )
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def get(self, request, slug, project_id):
        issues = listed_trashed_issues(slug, project_id)
        return self.paginate(
            request=request,
            queryset=issues,
            on_results=lambda results: TrashedIssueSerializer(results, many=True).data,
            default_per_page=50,
        )


class IssueTrashDetailEndpoint(BaseAPIView):
    @extend_schema(responses={204: OpenApiResponse(description="Permanently deleted")})
    @allow_permission([ROLE.ADMIN])
    def delete(self, request, slug, project_id, pk):
        purge_issues(trashed_issues(slug, project_id).filter(pk=pk))
        return Response(status=status.HTTP_204_NO_CONTENT)


class IssueRestoreEndpoint(BaseAPIView):
    @extend_schema(request=None, responses={204: OpenApiResponse(description="Restored")})
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id, pk):
        issue = trashed_issues(slug, project_id).get(pk=pk)
        error = restore_work_item(issue, request.user.id)
        if error:
            return Response({"error": error}, status=status.HTTP_409_CONFLICT)
        return Response(status=status.HTTP_204_NO_CONTENT)
