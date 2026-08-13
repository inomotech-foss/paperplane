# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import transaction

# Third party imports
from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiResponse, OpenApiRequest

# Module imports
from plane.api.serializers import IssueTypeSerializer
from plane.app.permissions import ProjectEntityPermission, WorkspaceEntityPermission
from plane.db.models import IssueType, Project, ProjectIssueType, Workspace
from plane.utils.issue_type import get_or_create_default_issue_type
from plane.utils.openapi import (
    issue_type_docs,
    FIELDS_PARAMETER,
    EXPAND_PARAMETER,
    INVALID_REQUEST_RESPONSE,
    DELETED_RESPONSE,
)
from .base import BaseAPIView


def project_issue_types(slug, project_id, user):
    """Types enabled for a project the user is an active member of."""
    return (
        IssueType.objects.filter(workspace__slug=slug)
        .filter(
            project_issue_types__project_id=project_id,
            project_issue_types__deleted_at__isnull=True,
        )
        .filter(
            project_issue_types__project__project_projectmember__member=user,
            project_issue_types__project__project_projectmember__is_active=True,
        )
        .filter(project_issue_types__project__archived_at__isnull=True)
        .select_related("workspace")
        .prefetch_related("project_issue_types")
        .distinct()
    )


def workspace_issue_types(slug):
    """Every type in the workspace, whichever projects use it."""
    return (
        IssueType.objects.filter(workspace__slug=slug)
        .select_related("workspace")
        .prefetch_related("project_issue_types")
    )


class IssueTypeListCreateAPIEndpoint(BaseAPIView):
    """Work Item Type List and Create Endpoint"""

    serializer_class = IssueTypeSerializer
    model = IssueType
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return project_issue_types(self.kwargs.get("slug"), self.kwargs.get("project_id"), self.request.user)

    @issue_type_docs(
        operation_id="create_work_item_type",
        summary="Create work item type",
        description="Create a work item type for a project. `is_epic` cannot be set through the API and is always created as `False`.",  # noqa: E501
        request=OpenApiRequest(request=IssueTypeSerializer),
        responses={
            201: OpenApiResponse(
                description="Work item type created",
                response=IssueTypeSerializer,
            ),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def post(self, request, slug, project_id):
        """Create work item type

        Create a work item type in the workspace and enable it for this
        project. `is_epic` is always forced to `False` through the API. If
        `is_default` is `True`, any other default type in the workspace is
        unset (a workspace has at most one default type).
        """
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
            return Response(
                IssueTypeSerializer(issue_type).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @issue_type_docs(
        operation_id="list_work_item_types",
        summary="List work item types",
        description="Retrieve all work item types enabled for a project. Lazily provisions the workspace's default 'Task' type (and enables it for the project) the first time this is called for a project that predates work item types.",  # noqa: E501
        parameters=[FIELDS_PARAMETER, EXPAND_PARAMETER],
        responses={
            200: OpenApiResponse(
                description="List of work item types",
                response=IssueTypeSerializer(many=True),
            ),
        },
    )
    def get(self, request, slug, project_id):
        """List work item types

        Retrieve all work item types enabled for a project. A project has a
        handful of types, so the whole list is returned at once.
        """
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        get_or_create_default_issue_type(project)
        serializer = IssueTypeSerializer(
            self.get_queryset(),
            many=True,
            fields=self.fields,
            expand=self.expand,
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class IssueTypeDetailAPIEndpoint(BaseAPIView):
    """Work Item Type Detail Endpoint"""

    serializer_class = IssueTypeSerializer
    model = IssueType
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return project_issue_types(self.kwargs.get("slug"), self.kwargs.get("project_id"), self.request.user)

    @issue_type_docs(
        operation_id="retrieve_work_item_type",
        summary="Retrieve work item type",
        description="Retrieve details of a specific work item type.",
        responses={
            200: OpenApiResponse(
                description="Work item type retrieved",
                response=IssueTypeSerializer,
            ),
        },
    )
    def get(self, request, slug, project_id, issue_type_id):
        """Retrieve work item type

        Retrieve details of a specific work item type.
        """
        serializer = IssueTypeSerializer(
            self.get_queryset().get(pk=issue_type_id),
            fields=self.fields,
            expand=self.expand,
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    @issue_type_docs(
        operation_id="update_work_item_type",
        summary="Update work item type",
        description="Partially update a work item type. `is_epic` cannot be changed once created.",
        request=OpenApiRequest(request=IssueTypeSerializer),
        responses={
            200: OpenApiResponse(
                description="Work item type updated",
                response=IssueTypeSerializer,
            ),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def patch(self, request, slug, project_id, issue_type_id):
        """Update work item type

        Partially update a work item type (name, description, logo,
        activation, ...). `is_epic` cannot be changed once created. If
        `is_default` is being set to `True`, any other default type in the
        workspace is unset.
        """
        issue_type = IssueType.objects.get(
            workspace__slug=slug,
            project_issue_types__project_id=project_id,
            pk=issue_type_id,
        )
        serializer = IssueTypeSerializer(issue_type, data=request.data, partial=True)
        if serializer.is_valid():
            with transaction.atomic():
                if serializer.validated_data.get("is_default"):
                    IssueType.objects.filter(workspace_id=issue_type.workspace_id, is_default=True).exclude(
                        pk=issue_type.pk
                    ).update(is_default=False)
                serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @issue_type_docs(
        operation_id="delete_work_item_type",
        summary="Delete work item type",
        description="Remove a work item type from a project.",
        responses={204: DELETED_RESPONSE},
    )
    def delete(self, request, slug, project_id, issue_type_id):
        """Delete work item type

        Unlinks the work item type from this project. The `IssueType` row
        itself is only deleted once it is unlinked from every project.
        Rejected with 400 when the type is the Epic type, is the project's
        current default type, or is the project's only remaining active
        type.
        """
        issue_type = IssueType.objects.get(
            workspace__slug=slug,
            project_issue_types__project_id=project_id,
            pk=issue_type_id,
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


class WorkspaceIssueTypeListCreateAPIEndpoint(BaseAPIView):
    """Workspace Work Item Type List and Create Endpoint"""

    serializer_class = IssueTypeSerializer
    model = IssueType
    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return workspace_issue_types(self.kwargs.get("slug"))

    @issue_type_docs(
        operation_id="list_workspace_work_item_types",
        summary="List workspace work item types",
        description="Retrieve every work item type in the workspace, including types no project has enabled yet.",
        parameters=[FIELDS_PARAMETER, EXPAND_PARAMETER],
        responses={
            200: OpenApiResponse(
                description="List of work item types",
                response=IssueTypeSerializer(many=True),
            ),
        },
    )
    def get(self, request, slug):
        """List workspace work item types

        Retrieve every work item type in the workspace. Each carries the
        `project_ids` it is enabled for.
        """
        serializer = IssueTypeSerializer(
            self.get_queryset(),
            many=True,
            fields=self.fields,
            expand=self.expand,
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    @issue_type_docs(
        operation_id="create_workspace_work_item_type",
        summary="Create workspace work item type",
        description="Create a work item type in the workspace, optionally enabling it for projects via `project_ids`.",
        request=OpenApiRequest(request=IssueTypeSerializer),
        responses={
            201: OpenApiResponse(
                description="Work item type created",
                response=IssueTypeSerializer,
            ),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def post(self, request, slug):
        """Create workspace work item type

        Create a work item type in the workspace. `project_ids` enables it for
        those projects straight away; leave it out to create the type without
        attaching it anywhere. `is_epic` is always forced to `False`.
        """
        workspace = Workspace.objects.get(slug=slug)
        project_ids = request.data.get("project_ids") or []
        projects = Project.objects.filter(workspace_id=workspace.id, pk__in=project_ids)
        if len(projects) != len(set(project_ids)):
            return Response(
                {"error": "One or more projects do not belong to this workspace"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = IssueTypeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if serializer.validated_data.get("is_default"):
                IssueType.objects.filter(workspace_id=workspace.id, is_default=True).update(is_default=False)
            issue_type = serializer.save(workspace_id=workspace.id, is_epic=False)
            ProjectIssueType.objects.bulk_create(
                [
                    ProjectIssueType(
                        project_id=project.id,
                        issue_type=issue_type,
                        workspace_id=workspace.id,
                        is_default=issue_type.is_default,
                    )
                    for project in projects
                ]
            )

        return Response(
            IssueTypeSerializer(self.get_queryset().get(pk=issue_type.id)).data,
            status=status.HTTP_201_CREATED,
        )


class WorkspaceIssueTypeDetailAPIEndpoint(BaseAPIView):
    """Workspace Work Item Type Detail Endpoint"""

    serializer_class = IssueTypeSerializer
    model = IssueType
    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return workspace_issue_types(self.kwargs.get("slug"))

    @issue_type_docs(
        operation_id="retrieve_workspace_work_item_type",
        summary="Retrieve workspace work item type",
        description="Retrieve a work item type by ID, whichever projects it is enabled for.",
        responses={
            200: OpenApiResponse(
                description="Work item type retrieved",
                response=IssueTypeSerializer,
            ),
        },
    )
    def get(self, request, slug, issue_type_id):
        """Retrieve workspace work item type"""
        serializer = IssueTypeSerializer(
            self.get_queryset().get(pk=issue_type_id),
            fields=self.fields,
            expand=self.expand,
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    @issue_type_docs(
        operation_id="update_workspace_work_item_type",
        summary="Update workspace work item type",
        description="Partially update a work item type. `is_epic` cannot be changed once created.",
        request=OpenApiRequest(request=IssueTypeSerializer),
        responses={
            200: OpenApiResponse(
                description="Work item type updated",
                response=IssueTypeSerializer,
            ),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def patch(self, request, slug, issue_type_id):
        """Update workspace work item type

        `project_ids` is read-only here; use the project routes or the import
        endpoint to change which projects a type is enabled for.
        """
        issue_type = IssueType.objects.get(workspace__slug=slug, pk=issue_type_id)
        serializer = IssueTypeSerializer(issue_type, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if serializer.validated_data.get("is_default"):
                IssueType.objects.filter(workspace_id=issue_type.workspace_id, is_default=True).exclude(
                    pk=issue_type.pk
                ).update(is_default=False)
            serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    @issue_type_docs(
        operation_id="delete_workspace_work_item_type",
        summary="Delete workspace work item type",
        description="Delete a work item type and unlink it from every project.",
        responses={204: DELETED_RESPONSE, 400: INVALID_REQUEST_RESPONSE},
    )
    def delete(self, request, slug, issue_type_id):
        """Delete workspace work item type

        Removes the type from every project that has it enabled. Rejected when
        the type is the Epic type, the workspace default, or the last active
        type of any project still using it.
        """
        issue_type = IssueType.objects.get(workspace__slug=slug, pk=issue_type_id)
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

        stranded = [
            str(link.project_id)
            for link in ProjectIssueType.objects.filter(issue_type_id=issue_type.id, deleted_at__isnull=True)
            if not ProjectIssueType.objects.filter(
                project_id=link.project_id,
                deleted_at__isnull=True,
                issue_type__is_active=True,
            )
            .exclude(issue_type_id=issue_type.id)
            .exists()
        ]
        if stranded:
            return Response(
                {"error": f"This is the only work item type of project(s) {', '.join(stranded)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            ProjectIssueType.objects.filter(issue_type_id=issue_type.id).delete()
            issue_type.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class IssueTypeImportAPIEndpoint(BaseAPIView):
    """Bulk-enable workspace work item types for a project."""

    serializer_class = IssueTypeSerializer
    model = IssueType
    permission_classes = [ProjectEntityPermission]

    @issue_type_docs(
        operation_id="import_work_item_types",
        summary="Import work item types into a project",
        description="Enable one or more workspace work item types for a project. Types already enabled are left alone.",
        request=OpenApiRequest(request=IssueTypeSerializer),
        responses={
            200: OpenApiResponse(
                description="Work item types enabled for the project",
                response=IssueTypeSerializer(many=True),
            ),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def post(self, request, slug, project_id):
        """Import work item types into a project

        Takes `{"work_item_types": [<uuid>, ...]}` and links each to the
        project. Already-linked types are skipped, so this is idempotent.
        Returns every type the project now has.
        """
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        requested = request.data.get("work_item_types") or []
        if not isinstance(requested, list):
            return Response(
                {"error": "work_item_types must be a list of work item type ids"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        issue_types = IssueType.objects.filter(workspace_id=project.workspace_id, pk__in=requested)
        if len(issue_types) != len(set(requested)):
            return Response(
                {"error": "One or more work item types do not belong to this workspace"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        already_linked = set(
            ProjectIssueType.objects.filter(project_id=project_id, deleted_at__isnull=True).values_list(
                "issue_type_id", flat=True
            )
        )
        ProjectIssueType.objects.bulk_create(
            [
                ProjectIssueType(
                    project_id=project_id,
                    issue_type=issue_type,
                    workspace_id=project.workspace_id,
                )
                for issue_type in issue_types
                if issue_type.id not in already_linked
            ]
        )

        serializer = IssueTypeSerializer(
            project_issue_types(slug, project_id, request.user),
            many=True,
        )
        return Response(serializer.data, status=status.HTTP_200_OK)
