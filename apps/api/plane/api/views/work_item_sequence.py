# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Work item numbering: where a project's counter stands, moving it forward, renumbering one item."""

from drf_spectacular.utils import OpenApiExample, OpenApiRequest, OpenApiResponse
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ProjectAdminPermission, ProjectEntityPermission
from plane.db.models import Issue, Project
from plane.utils.issue_sequence import (
    IssueSequenceStartError,
    IssueSequenceTakenError,
    get_last_issue_sequence,
    issue_sequence_start_error,
    renumber_issue,
    set_next_issue_sequence,
)
from plane.utils.openapi import (
    CONFLICT_RESPONSE,
    INVALID_REQUEST_RESPONSE,
    ISSUE_ID_PARAMETER,
    PROJECT_ID_PARAMETER,
    project_docs,
    work_item_docs,
)

from .base import BaseAPIView


def parse_whole_number(value):
    """Return `value` as an int when it is a whole number (or a string holding one), else None."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


class ProjectAdminWritePermission(ProjectEntityPermission):
    """Project members may read; only project admins may write."""

    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return super().has_permission(request, view)
        return ProjectAdminPermission().has_permission(request, view)


class ProjectWorkItemSequenceAPIEndpoint(BaseAPIView):
    """The number the next work item created in a project receives."""

    model = Project
    permission_classes = [ProjectAdminWritePermission]

    @staticmethod
    def payload(project, last_sequence):
        return {
            "identifier": project.identifier,
            "last_sequence": last_sequence,
            "next_sequence": last_sequence + 1,
        }

    @project_docs(
        operation_id="retrieve_project_work_item_sequence",
        summary="Retrieve work item numbering",
        description="Retrieve the highest work item number recorded for the project and the number the next work item will receive.",  # noqa: E501
        parameters=[PROJECT_ID_PARAMETER],
        responses={
            200: OpenApiResponse(
                description="Work item numbering",
                examples=[
                    OpenApiExample(
                        name="Numbering",
                        value={"identifier": "PROJ", "last_sequence": 42, "next_sequence": 43},
                    )
                ],
            ),
        },
    )
    def get(self, request, slug, project_id):
        """Retrieve work item numbering"""
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        return Response(self.payload(project, get_last_issue_sequence(project)), status=status.HTTP_200_OK)

    @project_docs(
        operation_id="set_project_work_item_sequence_start",
        summary="Move work item numbering forward",
        description=(
            "Make the next work item created in the project receive `start`, for example 5000 so new work items "
            "become PROJ-5000, PROJ-5001 and so on. Existing work items keep their numbers. Numbers only ever "
            "count up, so `start` must be above the highest number recorded for the project. Project admins only."
        ),
        parameters=[PROJECT_ID_PARAMETER],
        request=OpenApiRequest(
            request=None,
            examples=[OpenApiExample(name="Start at 5000", value={"start": 5000})],
        ),
        responses={
            200: OpenApiResponse(
                description="Work item numbering after the change",
                examples=[
                    OpenApiExample(
                        name="Numbering",
                        value={"identifier": "PROJ", "last_sequence": 4999, "next_sequence": 5000},
                    )
                ],
            ),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def post(self, request, slug, project_id):
        """Move work item numbering forward"""
        project = Project.objects.get(pk=project_id, workspace__slug=slug)

        start = parse_whole_number(request.data.get("start"))
        if start is None:
            return Response({"error": "The start must be a whole number"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            set_next_issue_sequence(project, start)
        except IssueSequenceStartError:
            # Rebuild the explanation from fresh data rather than echoing the exception to the client.
            current = get_last_issue_sequence(project)
            error = issue_sequence_start_error(project, start, current) or "The numbering could not be changed"
            return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)

        return Response(self.payload(project, start - 1), status=status.HTTP_200_OK)


class WorkItemRenumberAPIEndpoint(BaseAPIView):
    """Change the number of one existing work item."""

    model = Issue
    permission_classes = [ProjectAdminPermission]

    @work_item_docs(
        operation_id="renumber_work_item",
        summary="Renumber work item",
        description=(
            "Give an existing work item a different number, for example turn PROJ-12 into PROJ-4711. "
            "The number must not be used by any other work item in the project, including deleted ones, "
            "since numbers are never reused. Renumbering above the highest recorded number also moves the "
            "counter, so later work items continue from there. Project admins only."
        ),
        parameters=[ISSUE_ID_PARAMETER],
        request=OpenApiRequest(
            request=None,
            examples=[OpenApiExample(name="Renumber to 4711", value={"sequence_id": 4711})],
        ),
        responses={
            200: OpenApiResponse(
                description="Work item renumbered",
                examples=[
                    OpenApiExample(
                        name="Renumbered",
                        value={
                            "id": "1f2d3c4b-5a69-4e7f-8a9b-0c1d2e3f4a5b",
                            "identifier": "PROJ-4711",
                            "previous_sequence_id": 12,
                            "sequence_id": 4711,
                        },
                    )
                ],
            ),
            400: INVALID_REQUEST_RESPONSE,
            409: CONFLICT_RESPONSE,
        },
    )
    def post(self, request, slug, project_id, issue_id):
        """Renumber work item"""
        issue = Issue.objects.select_related("project").get(
            pk=issue_id, project_id=project_id, workspace__slug=slug, project__workspace__slug=slug
        )

        sequence = parse_whole_number(request.data.get("sequence_id"))
        if sequence is None or sequence < 1:
            return Response(
                {"error": "sequence_id must be a whole number of at least 1"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            previous = renumber_issue(issue, sequence)
        except IssueSequenceTakenError:
            return Response(
                {"error": f"{issue.project.identifier}-{sequence} is already taken; numbers are never reused"},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(
            {
                "id": str(issue.id),
                "identifier": f"{issue.project.identifier}-{sequence}",
                "previous_sequence_id": previous,
                "sequence_id": sequence,
            },
            status=status.HTTP_200_OK,
        )
