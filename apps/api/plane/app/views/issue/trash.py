# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import TrashedIssueSerializer
from plane.bgtasks.deletion_task import purge_issues, restore_related_objects, undelete
from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import Issue, IssueType, State
from plane.utils.openapi import CURSOR_PARAMETER, PER_PAGE_PARAMETER
from plane.utils.derived_properties import schedule_derived_refresh
from plane.utils.openapi.pagination import paginated_response

from .. import BaseAPIView


def trashed_issues(slug, project_id):
    return Issue.all_objects.filter(workspace__slug=slug, project_id=project_id, deleted_at__isnull=False)


def restore_issue(issue):
    """Restore issue with everything its deletion removed. Returns an error message if it cannot be restored.

    An issue whose parent is still deleted comes back without a parent.
    """
    if IssueType.all_objects.filter(pk=issue.type_id, deleted_at__isnull=False).exists():
        return "The work item type of this work item was deleted"
    changes = {}
    if issue.parent_id and Issue.all_objects.filter(pk=issue.parent_id, deleted_at__isnull=False).exists():
        changes["parent"] = None
    if not State.objects.filter(pk=issue.state_id).exists():
        states = State.objects.filter(~Q(is_triage=True), project_id=issue.project_id)
        changes["state"] = states.filter(default=True).first() or states.first()
    since = issue.deleted_at
    if not undelete(issue, **changes):
        return "Another work item has the same number"
    restore_related_objects(Issue, [issue.pk], since)
    schedule_derived_refresh(issue.project_id)
    return None


class IssueTrashEndpoint(BaseAPIView):
    @extend_schema(
        parameters=[CURSOR_PARAMETER, PER_PAGE_PARAMETER],
        responses={200: paginated_response(TrashedIssueSerializer)},
    )
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def get(self, request, slug, project_id):
        # Sub-items deleted along with their parent come back with it, so only the parent is listed.
        issues = (
            trashed_issues(slug, project_id)
            .exclude(parent__deleted_at__lte=F("deleted_at"))
            .select_related("project")
            .order_by("-deleted_at")
        )
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
        with transaction.atomic():
            error = restore_issue(issue)
        if error:
            return Response({"error": error}, status=status.HTTP_409_CONFLICT)
        issue_activity.delay(
            type="issue.activity.restored",
            requested_data=None,
            current_instance=None,
            issue_id=str(issue.id),
            actor_id=str(request.user.id),
            project_id=str(project_id),
            epoch=int(timezone.now().timestamp()),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
