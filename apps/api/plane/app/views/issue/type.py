# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import transaction

# Third Party imports
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .. import BaseViewSet
from plane.app.permissions import ROLE, allow_permission, ProjectEntityPermission
from plane.app.serializers import (
    IssueTypeMigrationPreviewSerializer,
    IssueTypeMigrationRequestSerializer,
    IssueTypeSerializer,
)
from plane.db.models import IssueType, Project, ProjectIssueType, ProjectMember, WorkspaceMember
from plane.utils.issue_type_migration import (
    PROJECT,
    WORK_ITEMS,
    MigrationError,
    Scope,
    TypeReferences,
    migrate_type,
    remove_unused_type,
)


def _is_admin(user, slug, project_id):
    return (
        ProjectMember.objects.filter(member=user, project_id=project_id, role=ROLE.ADMIN.value, is_active=True).exists()
        or WorkspaceMember.objects.filter(
            member=user, workspace__slug=slug, role=ROLE.ADMIN.value, is_active=True
        ).exists()
    )


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
        serializer = IssueTypeSerializer(self.get_queryset(), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def create(self, request, slug, project_id):
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        serializer = IssueTypeSerializer(data=request.data)
        if serializer.is_valid():
            with transaction.atomic():
                issue_type = serializer.save(workspace_id=project.workspace_id, is_epic=False)
                ProjectIssueType.objects.create(
                    project_id=project_id,
                    issue_type=issue_type,
                    workspace_id=project.workspace_id,
                )
            issue_type = self.get_queryset().get(pk=issue_type.id)
            return Response(IssueTypeSerializer(issue_type).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN])
    def partial_update(self, request, slug, project_id, pk):
        issue_type = IssueType.objects.get(workspace__slug=slug, project_issue_types__project_id=project_id, pk=pk)
        serializer = IssueTypeSerializer(issue_type, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            issue_type = self.get_queryset().get(pk=pk)
            return Response(IssueTypeSerializer(issue_type).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(responses=IssueTypeMigrationPreviewSerializer)
    @allow_permission([ROLE.ADMIN])
    def usage(self, request, slug, project_id, pk):
        """What in the project uses the type, and which of its property values would need a decision."""
        issue_type = self.get_queryset().get(pk=pk)
        preview = TypeReferences(issue_type, Scope(PROJECT, project_id=str(project_id))).preview()
        return Response(IssueTypeMigrationPreviewSerializer(preview).data, status=status.HTTP_200_OK)

    @extend_schema(request=IssueTypeMigrationRequestSerializer, responses=IssueTypeMigrationPreviewSerializer)
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def migrate(self, request, slug, project_id, pk):
        """Move work items of the type to another type, see `migrate_type`.

        Members can migrate work items; the whole project needs an admin.
        """
        issue_type = IssueType.objects.get(workspace__slug=slug, pk=pk)
        scope = request.data.get("scope") if isinstance(request.data, dict) else None
        items_only = isinstance(scope, dict) and set(scope) == {WORK_ITEMS}
        if not items_only and not _is_admin(request.user, slug, project_id):
            return Response(
                {"error": "Only project admins can migrate the whole project."}, status=status.HTTP_403_FORBIDDEN
            )
        try:
            preview = migrate_type(issue_type, request.data, project_id=str(project_id))
        except MigrationError as error:
            return Response(error.payload, status=error.status)
        return Response(IssueTypeMigrationPreviewSerializer(preview).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def destroy(self, request, slug, project_id, pk):
        """Unlink the type from the project. 409 while anything in the project uses it."""
        issue_type = IssueType.objects.get(workspace__slug=slug, project_issue_types__project_id=project_id, pk=pk)
        try:
            remove_unused_type(issue_type, project_id)
        except MigrationError as error:
            return Response(error.payload, status=error.status)
        return Response(status=status.HTTP_204_NO_CONTENT)
