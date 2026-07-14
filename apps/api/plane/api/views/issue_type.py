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
from plane.app.permissions import ProjectEntityPermission
from plane.db.models import IssueType, Project, ProjectIssueType
from plane.utils.issue_type import get_or_create_default_issue_type
from plane.utils.openapi import (
    issue_type_docs,
    CURSOR_PARAMETER,
    PER_PAGE_PARAMETER,
    FIELDS_PARAMETER,
    EXPAND_PARAMETER,
    create_paginated_response,
    INVALID_REQUEST_RESPONSE,
    DELETED_RESPONSE,
)
from .base import BaseAPIView


class IssueTypeListCreateAPIEndpoint(BaseAPIView):
    """Work Item Type List and Create Endpoint"""

    serializer_class = IssueTypeSerializer
    model = IssueType
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            IssueType.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(
                project_issue_types__project_id=self.kwargs.get("project_id"),
                project_issue_types__deleted_at__isnull=True,
            )
            .filter(
                project_issue_types__project__project_projectmember__member=self.request.user,
                project_issue_types__project__project_projectmember__is_active=True,
            )
            .filter(project_issue_types__project__archived_at__isnull=True)
            .select_related("workspace")
            .distinct()
        )

    @issue_type_docs(
        operation_id="create_issue_type",
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
        operation_id="list_issue_types",
        summary="List work item types",
        description="Retrieve all work item types enabled for a project. Lazily provisions the workspace's default 'Task' type (and enables it for the project) the first time this is called for a project that predates work item types.",  # noqa: E501
        parameters=[
            CURSOR_PARAMETER,
            PER_PAGE_PARAMETER,
            FIELDS_PARAMETER,
            EXPAND_PARAMETER,
        ],
        responses={
            200: create_paginated_response(
                IssueTypeSerializer,
                "PaginatedIssueTypeResponse",
                "Paginated list of work item types",
                "Paginated Work Item Types",
            ),
        },
    )
    def get(self, request, slug, project_id):
        """List work item types

        Retrieve all work item types enabled for a project. Returns
        paginated results.
        """
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        get_or_create_default_issue_type(project)
        return self.paginate(
            request=request,
            queryset=(self.get_queryset()),
            on_results=lambda issue_types: IssueTypeSerializer(
                issue_types, many=True, fields=self.fields, expand=self.expand
            ).data,
        )


class IssueTypeDetailAPIEndpoint(BaseAPIView):
    """Work Item Type Detail Endpoint"""

    serializer_class = IssueTypeSerializer
    model = IssueType
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            IssueType.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(
                project_issue_types__project_id=self.kwargs.get("project_id"),
                project_issue_types__deleted_at__isnull=True,
            )
            .filter(
                project_issue_types__project__project_projectmember__member=self.request.user,
                project_issue_types__project__project_projectmember__is_active=True,
            )
            .filter(project_issue_types__project__archived_at__isnull=True)
            .select_related("workspace")
            .distinct()
        )

    @issue_type_docs(
        operation_id="retrieve_issue_type",
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
        operation_id="update_issue_type",
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
        operation_id="delete_issue_type",
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
