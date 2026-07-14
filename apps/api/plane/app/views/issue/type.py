# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import transaction

# Third Party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .. import BaseViewSet
from plane.app.permissions import ROLE, allow_permission, ProjectEntityPermission
from plane.app.serializers import IssueTypeSerializer
from plane.db.models import IssueType, Project, ProjectIssueType
from plane.utils.issue_type import get_or_create_default_issue_type


class IssueTypeViewSet(BaseViewSet):
    """CRUD for work item types enabled on a project.

    Only admins can create, update, or delete work item types; any active
    project member can list and retrieve them.
    """

    serializer_class = IssueTypeSerializer
    model = IssueType
    permission_classes = [ProjectEntityPermission]

    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(
                project_issue_types__project_id=self.kwargs.get("project_id"),
                project_issue_types__deleted_at__isnull=True,
            )
            .filter(
                project_issue_types__project__project_projectmember__member=self.request.user,
                project_issue_types__project__project_projectmember__is_active=True,
            )
            .select_related("workspace")
            .distinct()
        )

    def list(self, request, slug, project_id):
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        get_or_create_default_issue_type(project)
        serializer = IssueTypeSerializer(self.get_queryset(), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def create(self, request, slug, project_id):
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        serializer = IssueTypeSerializer(data=request.data)
        if serializer.is_valid():
            with transaction.atomic():
                if serializer.validated_data.get("is_default"):
                    IssueType.objects.filter(workspace_id=project.workspace_id, is_default=True).update(
                        is_default=False
                    )
                issue_type = serializer.save(workspace_id=project.workspace_id, is_epic=False)
                ProjectIssueType.objects.create(
                    project_id=project_id,
                    issue_type=issue_type,
                    workspace_id=project.workspace_id,
                    is_default=issue_type.is_default,
                )
            issue_type = self.get_queryset().get(pk=issue_type.id)
            return Response(IssueTypeSerializer(issue_type).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN])
    def partial_update(self, request, slug, project_id, pk):
        issue_type = IssueType.objects.get(
            workspace__slug=slug, project_issue_types__project_id=project_id, pk=pk
        )
        serializer = IssueTypeSerializer(issue_type, data=request.data, partial=True)
        if serializer.is_valid():
            with transaction.atomic():
                if serializer.validated_data.get("is_default"):
                    IssueType.objects.filter(workspace_id=issue_type.workspace_id, is_default=True).exclude(
                        pk=issue_type.pk
                    ).update(is_default=False)
                serializer.save()
            issue_type = self.get_queryset().get(pk=pk)
            return Response(IssueTypeSerializer(issue_type).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN])
    def destroy(self, request, slug, project_id, pk):
        issue_type = IssueType.objects.get(
            workspace__slug=slug, project_issue_types__project_id=project_id, pk=pk
        )
        if issue_type.is_epic:
            return Response(
                {"error": "Epic type cannot be removed"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if issue_type.is_default:
            return Response(
                {"error": "Cannot delete the default type; set another type as default first"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        remaining = (
            ProjectIssueType.objects.filter(
                project_id=project_id,
                deleted_at__isnull=True,
                issue_type__is_active=True,
            )
            .exclude(issue_type_id=issue_type.id)
            .count()
        )
        if remaining == 0:
            return Response(
                {"error": "A project must have at least one work item type"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            ProjectIssueType.objects.filter(project_id=project_id, issue_type_id=issue_type.id).delete()
            if not ProjectIssueType.objects.filter(issue_type_id=issue_type.id).exists():
                issue_type.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
