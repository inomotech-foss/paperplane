# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Dates rolled up from the work items below a parent, for the timeline."""

# Python imports
import uuid

# Third Party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .. import BaseAPIView
from plane.app.permissions import ROLE, allow_permission
from plane.db.models import Issue, Project, ProjectMember
from plane.utils.issue_hierarchy import IssueTree, date_rollup

MAX_ROLLUP_IDS = 500


class IssueDateRollupEndpoint(BaseAPIView):
    """GET `?issue_ids=<comma separated ids>` answers, for each listed work item that has work
    items below it, the earliest start and latest end date among all of them (any depth), plus
    how many children and descendants it has:

        {"<id>": {"start_date": "2026-01-05", "target_date": "2026-03-31",
                  "children_count": 2, "descendants_count": 7}}

    Listed work items without children are left out. Archived, deleted and draft work items
    do not count. A guest who only sees their own work items only gets dates from those.
    """

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        raw_ids = [raw.strip() for raw in request.GET.get("issue_ids", "").split(",") if raw.strip()]
        if not raw_ids:
            return Response({}, status=status.HTTP_200_OK)
        if len(raw_ids) > MAX_ROLLUP_IDS:
            return Response(
                {"error": f"At most {MAX_ROLLUP_IDS} work items per request"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            issue_ids = [uuid.UUID(raw) for raw in raw_ids]
        except ValueError:
            return Response({"error": "issue_ids must be work item ids"}, status=status.HTTP_400_BAD_REQUEST)

        queryset = Issue.issue_objects.filter(workspace__slug=slug, project_id=project_id)
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        is_restricted_guest = (
            not project.guest_view_all_features
            and ProjectMember.objects.filter(
                project_id=project_id, member=request.user, role=ROLE.GUEST.value, is_active=True
            ).exists()
        )
        if is_restricted_guest:
            queryset = queryset.filter(created_by=request.user)

        tree = IssueTree.for_project(project_id, fields=("start_date", "target_date"), queryset=queryset)
        rollups = {}
        for issue_id in issue_ids:
            if issue_id not in tree:
                continue
            rollup = date_rollup(tree, issue_id)
            if rollup is None:
                continue
            rollups[str(issue_id)] = {
                **rollup,
                "start_date": rollup["start_date"].isoformat() if rollup["start_date"] else None,
                "target_date": rollup["target_date"].isoformat() if rollup["target_date"] else None,
            }
        return Response(rollups, status=status.HTTP_200_OK)
