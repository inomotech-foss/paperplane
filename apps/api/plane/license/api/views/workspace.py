# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework.response import Response
from rest_framework import status
from django.db import IntegrityError, transaction
from django.db.models import OuterRef, Func, F
from django.shortcuts import get_object_or_404

# Module imports
from plane.app.views.base import BaseAPIView
from plane.license.api.permissions import InstanceAdminPermission
from plane.db.models import Profile, Project, User, Workspace, WorkspaceMember
from plane.license.api.serializers import WorkspaceSerializer
from plane.utils.constants import RESTRICTED_WORKSPACE_SLUGS


class InstanceWorkSpaceAvailabilityCheckEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    def get(self, request):
        slug = request.GET.get("slug", False)

        if not slug or slug == "":
            return Response(
                {"error": "Workspace Slug is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        workspace = Workspace.objects.filter(slug__iexact=slug).exists() or slug in RESTRICTED_WORKSPACE_SLUGS
        return Response({"status": not workspace}, status=status.HTTP_200_OK)


class InstanceWorkSpaceEndpoint(BaseAPIView):
    model = Workspace
    serializer_class = WorkspaceSerializer
    permission_classes = [InstanceAdminPermission]

    def get(self, request):
        project_count = (
            Project.objects.filter(workspace_id=OuterRef("id"))
            .order_by()
            .annotate(count=Func(F("id"), function="Count"))
            .values("count")
        )

        member_count = (
            WorkspaceMember.objects.filter(workspace=OuterRef("id"), member__is_bot=False, is_active=True)
            .select_related("owner")
            .order_by()
            .annotate(count=Func(F("id"), function="Count"))
            .values("count")
        )

        workspaces = Workspace.objects.annotate(total_projects=project_count, total_members=member_count)

        # Add search functionality
        search = request.query_params.get("search", None)
        if search:
            workspaces = workspaces.filter(name__icontains=search)

        return self.paginate(
            request=request,
            queryset=workspaces,
            on_results=lambda results: WorkspaceSerializer(results, many=True).data,
            max_per_page=10,
            default_per_page=10,
        )

    def post(self, request):
        try:
            serializer = WorkspaceSerializer(data=request.data)

            slug = request.data.get("slug", False)
            name = request.data.get("name", False)

            if not name or not slug:
                return Response(
                    {"error": "Both name and slug are required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if len(name) > 80 or len(slug) > 48:
                return Response(
                    {"error": "The maximum length for name is 80 and for slug is 48"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if serializer.is_valid(raise_exception=True):
                serializer.save(owner=request.user)
                # Create Workspace member
                _ = WorkspaceMember.objects.create(
                    workspace_id=serializer.data["id"],
                    member=request.user,
                    role=20,
                    company_role=request.data.get("company_role", ""),
                )
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(
                [serializer.errors[error][0] for error in serializer.errors],
                status=status.HTTP_400_BAD_REQUEST,
            )

        except IntegrityError as e:
            if "already exists" in str(e):
                return Response(
                    {"slug": "The workspace with the slug already exists"},
                    status=status.HTTP_409_CONFLICT,
                )


def annotated_workspaces():
    project_count = (
        Project.objects.filter(workspace_id=OuterRef("id"))
        .order_by()
        .annotate(count=Func(F("id"), function="Count"))
        .values("count")
    )
    member_count = (
        WorkspaceMember.objects.filter(workspace=OuterRef("id"), member__is_bot=False, is_active=True)
        .order_by()
        .annotate(count=Func(F("id"), function="Count"))
        .values("count")
    )
    return Workspace.objects.annotate(total_projects=project_count, total_members=member_count).select_related("owner")


class InstanceWorkSpaceDetailEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    def get(self, request, pk):
        workspace = get_object_or_404(annotated_workspaces(), pk=pk)
        return Response(WorkspaceSerializer(workspace).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        workspace = get_object_or_404(Workspace, pk=pk)
        Profile.objects.filter(last_workspace_id=workspace.id).update(last_workspace_id=None)
        workspace.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class InstanceWorkSpaceTransferOwnerEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    def post(self, request, pk):
        workspace = get_object_or_404(Workspace, pk=pk)
        owner_id = request.data.get("owner")
        if not owner_id:
            return Response({"error": "owner is required"}, status=status.HTTP_400_BAD_REQUEST)
        owner = get_object_or_404(User, pk=owner_id)
        if owner.is_bot or owner.deleted_at or not owner.is_active:
            return Response({"error": "The new owner must be an active user."}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            workspace.owner = owner
            workspace.save(update_fields=["owner"])
            membership = WorkspaceMember.objects.filter(workspace=workspace, member=owner).first()
            if membership is None:
                WorkspaceMember.objects.create(workspace=workspace, member=owner, role=20)
            else:
                membership.role = 20
                membership.is_active = True
                membership.save()
        return Response(WorkspaceSerializer(annotated_workspaces().get(pk=pk)).data, status=status.HTTP_200_OK)
