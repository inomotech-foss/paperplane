# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Page review and approval, for people in the app.

Approving and rejecting live here only: these views authenticate by session
cookie alone, and page_approval.approve/reject refuse token-authenticated
requests and bots on top of that. API v1 offers status, submit, review dates
and the register, never a decision.

Baselining is project-level and for project admins only: a preview, then a
background task that baselines the chosen pages.
"""

from django.db import transaction
from django.db.models import Q
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, ProjectPagePermission, allow_permission
from plane.app.serializers.page_approval import (
    PageApprovalApproveSerializer,
    PageApprovalEventSerializer,
    PageApprovalRegisterRowSerializer,
    PageApprovalRejectSerializer,
    PageApprovalReviewDateSerializer,
    PageApprovalStatusWithAbilitiesSerializer,
    PageApprovalSubmitSerializer,
    PageApproverSerializer,
    PageApproversUpdateSerializer,
    PageBaselinePreviewSerializer,
    PageBaselineQueuedSerializer,
    PageBaselineRequestSerializer,
    baseline_preview,
    baseline_queryset,
    register_queryset,
    register_rows,
    status_payload,
)
from plane.bgtasks.page_baseline_task import baseline_pages
from plane.db.models import Page, PageApprovalEvent, PageApprover, Project, ProjectMember
from plane.utils import page_approval
from plane.utils.page_approval import ApprovalError

from ..base import BaseAPIView

APPROVAL_ERROR = OpenApiResponse(description="Refused: see error_code")


def project_page(slug, project_id, page_id, user):
    """The page as the URL names it, if this user can see it."""
    return (
        Page.objects.filter(
            pk=page_id,
            workspace__slug=slug,
            project_pages__project_id=project_id,
            project_pages__deleted_at__isnull=True,
        )
        .filter(Q(access=Page.PUBLIC_ACCESS) | Q(owned_by=user))
        .distinct()
        .first()
    )


def refused(error):
    return Response(error.as_response_data(), status=error.http_status)


class PageApprovalEndpoint(BaseAPIView):
    """Where a page stands in review, and what the current user may do about it."""

    permission_classes = [ProjectPagePermission]

    @extend_schema(responses={200: PageApprovalStatusWithAbilitiesSerializer})
    def get(self, request, slug, project_id, page_id):
        page = project_page(slug, project_id, page_id, request.user)
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(status_payload(page, project_id, request), status=status.HTTP_200_OK)


class PageApprovalSubmitEndpoint(BaseAPIView):
    permission_classes = [ProjectPagePermission]

    @extend_schema(
        request=PageApprovalSubmitSerializer,
        responses={200: PageApprovalStatusWithAbilitiesSerializer, 400: APPROVAL_ERROR},
    )
    def post(self, request, slug, project_id, page_id):
        """Submit the page as it is now for review. Needs edit access to the page."""
        page = project_page(slug, project_id, page_id, request.user)
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = PageApprovalSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            page_approval.submit(page, project_id, request.user, serializer.validated_data["comment"])
        except ApprovalError as error:
            return refused(error)
        return Response(status_payload(page, project_id, request), status=status.HTTP_200_OK)


class PageApprovalApproveEndpoint(BaseAPIView):
    permission_classes = [ProjectPagePermission]

    @extend_schema(
        request=PageApprovalApproveSerializer,
        responses={200: PageApprovalStatusWithAbilitiesSerializer, 400: APPROVAL_ERROR, 403: APPROVAL_ERROR},
    )
    def post(self, request, slug, project_id, page_id):
        """Approve the version under review; it becomes the version in force."""
        page = project_page(slug, project_id, page_id, request.user)
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = PageApprovalApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            page_approval.approve(
                request,
                page,
                project_id,
                serializer.validated_data["comment"],
                serializer.validated_data["next_review_date"],
            )
        except ApprovalError as error:
            return refused(error)
        return Response(status_payload(page, project_id, request), status=status.HTTP_200_OK)


class PageApprovalRejectEndpoint(BaseAPIView):
    permission_classes = [ProjectPagePermission]

    @extend_schema(
        request=PageApprovalRejectSerializer,
        responses={200: PageApprovalStatusWithAbilitiesSerializer, 400: APPROVAL_ERROR, 403: APPROVAL_ERROR},
    )
    def post(self, request, slug, project_id, page_id):
        """Reject the version under review, saying why. The version in force stays."""
        page = project_page(slug, project_id, page_id, request.user)
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = PageApprovalRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            page_approval.reject(request, page, project_id, serializer.validated_data["comment"])
        except ApprovalError as error:
            return refused(error)
        return Response(status_payload(page, project_id, request), status=status.HTTP_200_OK)


class PageApprovalReviewDateEndpoint(BaseAPIView):
    permission_classes = [ProjectPagePermission]

    @extend_schema(
        request=PageApprovalReviewDateSerializer,
        responses={200: PageApprovalStatusWithAbilitiesSerializer, 400: APPROVAL_ERROR, 403: APPROVAL_ERROR},
    )
    def post(self, request, slug, project_id, page_id):
        """Set or clear the date the page is next due for review."""
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
        return Response(status_payload(page, project_id, request), status=status.HTTP_200_OK)


class PageApprovalEventsEndpoint(BaseAPIView):
    """The page's approval log, newest first."""

    permission_classes = [ProjectPagePermission]

    @extend_schema(responses={200: PageApprovalEventSerializer(many=True)})
    def get(self, request, slug, project_id, page_id):
        page = project_page(slug, project_id, page_id, request.user)
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        events = PageApprovalEvent.objects.filter(page_id=page.id).order_by("-created_at")
        return Response(PageApprovalEventSerializer(events, many=True).data, status=status.HTTP_200_OK)


class ProjectPageApprovalRegisterEndpoint(BaseAPIView):
    """The document register: every live page of the project with its approval state."""

    @extend_schema(responses={200: PageApprovalRegisterRowSerializer(many=True), 400: APPROVAL_ERROR})
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def get(self, request, slug, project_id):
        try:
            page_approval.require_enabled(project_id)
        except ApprovalError as error:
            return refused(error)
        rows = register_rows(register_queryset(slug, project_id, request.user))
        return Response(PageApprovalRegisterRowSerializer(rows, many=True).data, status=status.HTTP_200_OK)


class ProjectPageApproversEndpoint(BaseAPIView):
    """Who may approve the project's pages. Project admins maintain the list."""

    @extend_schema(responses={200: PageApproverSerializer(many=True)})
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        approvers = PageApprover.objects.filter(project_id=project_id, workspace__slug=slug)
        return Response(PageApproverSerializer(approvers, many=True).data, status=status.HTTP_200_OK)

    @extend_schema(
        request=PageApproversUpdateSerializer,
        responses={200: PageApproverSerializer(many=True), 400: OpenApiResponse(description="Not project members")},
    )
    @allow_permission([ROLE.ADMIN])
    def put(self, request, slug, project_id):
        """Replace the approver list. Approvers must be project members or admins, not guests."""
        serializer = PageApproversUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        wanted = set(serializer.validated_data["member_ids"])
        eligible = set(
            ProjectMember.objects.filter(
                project_id=project_id,
                workspace__slug=slug,
                member_id__in=wanted,
                is_active=True,
                role__in=[ROLE.ADMIN.value, ROLE.MEMBER.value],
            ).values_list("member_id", flat=True)
        )
        if wanted - eligible:
            return Response(
                {
                    "error": "Approvers must be active project members or admins",
                    "member_ids": sorted(str(member) for member in wanted - eligible),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        with transaction.atomic():
            PageApprover.objects.filter(project_id=project_id).exclude(member_id__in=wanted).delete(soft=False)
            existing = set(PageApprover.objects.filter(project_id=project_id).values_list("member_id", flat=True))
            for member in wanted - existing:
                # one by one, so each row records who added it
                PageApprover.objects.create(project_id=project_id, workspace_id=project.workspace_id, member_id=member)
        approvers = PageApprover.objects.filter(project_id=project_id)
        return Response(PageApproverSerializer(approvers, many=True).data, status=status.HTTP_200_OK)


class ProjectPageBaselineEndpoint(BaseAPIView):
    """Baseline existing pages: put their current content in force without a review. Project admins only."""

    @extend_schema(responses={200: PageBaselinePreviewSerializer, 400: APPROVAL_ERROR})
    @allow_permission([ROLE.ADMIN])
    def get(self, request, slug, project_id):
        """What baselining would do for each page of the project. Writes nothing."""
        try:
            page_approval.require_enabled(project_id)
        except ApprovalError as error:
            return refused(error)
        preview = baseline_preview(baseline_queryset(slug, project_id, request.user))
        return Response(PageBaselinePreviewSerializer(preview).data, status=status.HTTP_200_OK)

    @extend_schema(
        request=PageBaselineRequestSerializer,
        responses={
            202: PageBaselineQueuedSerializer,
            400: OpenApiResponse(description="Refused: see error_code, or page_ids not in the project"),
        },
    )
    @allow_permission([ROLE.ADMIN])
    def post(self, request, slug, project_id):
        """Queue the given pages, or every eligible page, for baselining. Pages that cannot be baselined are skipped."""
        try:
            page_approval.require_enabled(project_id)
        except ApprovalError as error:
            return refused(error)
        serializer = PageBaselineRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        pages = baseline_queryset(slug, project_id, request.user)
        if data["page_ids"]:
            wanted = set(data["page_ids"])
            pages = pages.filter(pk__in=wanted)
            missing = wanted - {page.id for page in pages}
            if missing:
                return Response(
                    {
                        "error_code": "PAGES_NOT_IN_PROJECT",
                        "error": "Some pages are not pages of this project",
                        "page_ids": sorted(str(page_id) for page_id in missing),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        queued, skipped = [], 0
        for page in pages:
            if page_approval.baseline_skip_reason(page, data["include_locked"]):
                skipped += 1
            else:
                queued.append(str(page.id))
        if queued:
            baseline_pages.delay(
                project_id=str(project_id),
                page_ids=queued,
                actor_id=str(request.user.id),
                next_review_date=data["next_review_date"].isoformat() if data["next_review_date"] else None,
                comment=data["comment"],
                include_locked=data["include_locked"],
            )
        return Response(
            PageBaselineQueuedSerializer({"queued": len(queued), "skipped": skipped}).data,
            status=status.HTTP_202_ACCEPTED,
        )
