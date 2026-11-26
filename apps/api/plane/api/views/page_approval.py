# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Page approvals over API v1: read the state, submit, schedule reviews.

API keys and OAuth tokens act for a person but are not that person at the
keyboard, so there is deliberately no approve or reject here. Decisions are
made in the app (plane.app.views.page.approval), which takes session
cookies only.

Nor is there a way to baseline a page here: a baseline puts content in force
without review, so only an admin running the baseline_page_approvals
command can do it. The read endpoints report baselines as such.
"""

from drf_spectacular.utils import OpenApiRequest, OpenApiResponse
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, ProjectEntityPermission, ProjectPagePermission, allow_permission
from plane.app.serializers.page_approval import (
    PageApprovalEventSerializer,
    PageApprovalRegisterRowSerializer,
    PageApprovalReviewDateSerializer,
    PageApprovalStatusSerializer,
    PageApprovalSubmitSerializer,
    register_queryset,
    register_rows,
    status_payload,
)
from plane.app.views.page.approval import project_page, refused
from plane.db.models import PageApprovalEvent
from plane.utils import page_approval
from plane.utils.openapi import (
    CURSOR_PARAMETER,
    INVALID_REQUEST_RESPONSE,
    PER_PAGE_PARAMETER,
    create_paginated_response,
    page_docs,
)
from plane.utils.page_approval import ApprovalError

from .base import BaseAPIView

APPROVAL_ERROR = OpenApiResponse(description="Refused: see error_code")


class PageApprovalAPIEndpoint(BaseAPIView):
    permission_classes = [ProjectPagePermission]

    @page_docs(
        operation_id="retrieve_page_approval",
        summary="Retrieve page approval status",
        description=(
            "Where the page stands in review: status, the version in force and who approved it, "
            "the next review date and whether it is overdue. A version in force can be a baseline "
            "(in_force_kind=baseline, status baseline until the next submission): content put in force "
            "without review when approvals were switched on. It names no approver; legacy_* carry the "
            "approval the page recorded before, as written."
        ),
        responses={200: OpenApiResponse(description="Approval status", response=PageApprovalStatusSerializer)},
    )
    def get(self, request, slug, project_id, page_id):
        """Retrieve page approval status"""
        page = project_page(slug, project_id, page_id, request.user)
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(status_payload(page, project_id), status=status.HTTP_200_OK)


class PageApprovalSubmitAPIEndpoint(BaseAPIView):
    permission_classes = [ProjectPagePermission]

    @page_docs(
        operation_id="submit_page_for_review",
        summary="Submit page for review",
        description=(
            "Snapshot the page as it is now and ask the project's approvers to review it. "
            "Approving and rejecting are only possible in the app."
        ),
        request=OpenApiRequest(request=PageApprovalSubmitSerializer),
        responses={
            200: OpenApiResponse(description="Submitted", response=PageApprovalStatusSerializer),
            400: APPROVAL_ERROR,
        },
    )
    def post(self, request, slug, project_id, page_id):
        """Submit page for review"""
        page = project_page(slug, project_id, page_id, request.user)
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = PageApprovalSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            page_approval.submit(page, project_id, request.user, serializer.validated_data["comment"])
        except ApprovalError as error:
            return refused(error)
        return Response(status_payload(page, project_id), status=status.HTTP_200_OK)


class PageApprovalReviewDateAPIEndpoint(BaseAPIView):
    permission_classes = [ProjectPagePermission]

    @page_docs(
        operation_id="set_page_review_date",
        summary="Set page review date",
        description="Set or clear the date the page is next due for review. Page approvers and project admins only.",
        request=OpenApiRequest(request=PageApprovalReviewDateSerializer),
        responses={
            200: OpenApiResponse(description="Review date set", response=PageApprovalStatusSerializer),
            400: APPROVAL_ERROR,
        },
    )
    def post(self, request, slug, project_id, page_id):
        """Set page review date"""
        page = project_page(slug, project_id, page_id, request.user)
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = PageApprovalReviewDateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            page_approval.set_review_date(
                page,
                project_id,
                request.user,
                serializer.validated_data["next_review_date"],
                serializer.validated_data["comment"],
            )
        except ApprovalError as error:
            return refused(error)
        return Response(status_payload(page, project_id), status=status.HTTP_200_OK)


class PageApprovalEventsAPIEndpoint(BaseAPIView):
    permission_classes = [ProjectPagePermission]

    @page_docs(
        operation_id="list_page_approval_events",
        summary="List page approval events",
        description=(
            "The page's approval log, newest first: submissions, approvals, rejections, review dates "
            "and baselines (action baselined, which is not an approval)."
        ),
        parameters=[CURSOR_PARAMETER, PER_PAGE_PARAMETER],
        responses={
            200: create_paginated_response(
                PageApprovalEventSerializer,
                "PaginatedPageApprovalEventResponse",
                "Paginated approval events",
                "Paginated Page Approval Events",
            )
        },
    )
    def get(self, request, slug, project_id, page_id):
        """List page approval events"""
        page = project_page(slug, project_id, page_id, request.user)
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        return self.paginate(
            request=request,
            queryset=PageApprovalEvent.objects.filter(page_id=page.id).order_by("-created_at"),
            on_results=lambda events: PageApprovalEventSerializer(events, many=True).data,
        )


class PageApprovalRegisterAPIEndpoint(BaseAPIView):
    """The document register of a project."""

    permission_classes = [ProjectEntityPermission]

    @page_docs(
        operation_id="list_page_approvals",
        summary="List the document register",
        description=(
            "Every live page of the project with its approval status, the version in force "
            "(approved, or a baseline that was not reviewed), who approved it and when, "
            "the next review date and whether that is overdue. "
            "Only for projects with page approvals switched on."
        ),
        parameters=[CURSOR_PARAMETER, PER_PAGE_PARAMETER],
        responses={
            200: create_paginated_response(
                PageApprovalRegisterRowSerializer,
                "PaginatedPageApprovalRegisterResponse",
                "Paginated document register",
                "Paginated Document Register",
            ),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def get(self, request, slug, project_id):
        """List the document register"""
        try:
            page_approval.require_enabled(project_id)
        except ApprovalError as error:
            return refused(error)
        return self.paginate(
            request=request,
            queryset=register_queryset(slug, project_id, request.user),
            on_results=lambda rows: PageApprovalRegisterRowSerializer(register_rows(rows), many=True).data,
        )
