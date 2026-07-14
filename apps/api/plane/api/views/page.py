# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db.models import Q

# Third party imports
from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiResponse, OpenApiRequest

# Module imports
from plane.api.serializers import PageSerializer
from plane.app.permissions import ProjectEntityPermission
from plane.db.models import Page, Project, ProjectPage
from .base import BaseAPIView
from plane.utils.openapi import (
    page_docs,
    CURSOR_PARAMETER,
    PER_PAGE_PARAMETER,
    FIELDS_PARAMETER,
    EXPAND_PARAMETER,
    create_paginated_response,
    INVALID_REQUEST_RESPONSE,
    EXTERNAL_ID_EXISTS_RESPONSE,
)


class PageListCreateAPIEndpoint(BaseAPIView):
    """Page List and Create Endpoint"""

    serializer_class = PageSerializer
    model = Page
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            Page.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(
                projects__id=self.kwargs.get("project_id"),
                project_pages__deleted_at__isnull=True,
            )
            .filter(
                projects__project_projectmember__member=self.request.user,
                projects__project_projectmember__is_active=True,
            )
            .filter(projects__archived_at__isnull=True)
            .filter(Q(owned_by=self.request.user) | Q(access=Page.PUBLIC_ACCESS))
            .select_related("workspace")
            .select_related("owned_by")
            .distinct()
        )

    @page_docs(
        operation_id="create_page",
        summary="Create page",
        description="Create a new page in a project with the given name and HTML description.",
        request=OpenApiRequest(request=PageSerializer),
        responses={
            201: OpenApiResponse(
                description="Page created",
                response=PageSerializer,
            ),
            400: INVALID_REQUEST_RESPONSE,
            409: EXTERNAL_ID_EXISTS_RESPONSE,
        },
    )
    def post(self, request, slug, project_id):
        """Create page

        Create a new page in a project with the given name and HTML description.
        Supports external ID tracking for integration purposes.
        """
        project = Project.objects.get(pk=project_id, workspace__slug=slug)

        if (
            request.data.get("external_id")
            and request.data.get("external_source")
            and Page.objects.filter(
                workspace__slug=slug,
                projects__id=project_id,
                external_source=request.data.get("external_source"),
                external_id=request.data.get("external_id"),
            ).exists()
        ):
            page = Page.objects.filter(
                workspace__slug=slug,
                projects__id=project_id,
                external_source=request.data.get("external_source"),
                external_id=request.data.get("external_id"),
            ).first()
            return Response(
                {
                    "error": "Page with the same external id and external source already exists",
                    "id": str(page.id),
                },
                status=status.HTTP_409_CONFLICT,
            )

        serializer = PageSerializer(data=request.data)
        if serializer.is_valid():
            parent = serializer.validated_data.get("parent")
            if parent and not Page.objects.filter(
                pk=parent.id, workspace__slug=slug, projects__id=project_id
            ).exists():
                return Response(
                    {"error": "Parent page does not exist in the project"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            page = serializer.save(
                workspace_id=project.workspace_id,
                owned_by_id=request.user.id,
            )
            # Link the page to the project
            ProjectPage.objects.create(
                workspace_id=project.workspace_id,
                project_id=project_id,
                page_id=page.id,
                created_by_id=page.created_by_id,
                updated_by_id=page.updated_by_id,
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @page_docs(
        operation_id="list_pages",
        summary="List pages",
        description="Retrieve all pages in a project.",
        parameters=[
            CURSOR_PARAMETER,
            PER_PAGE_PARAMETER,
            FIELDS_PARAMETER,
            EXPAND_PARAMETER,
        ],
        responses={
            200: create_paginated_response(
                PageSerializer,
                "PaginatedPageResponse",
                "Paginated list of pages",
                "Paginated Pages",
            ),
        },
    )
    def get(self, request, slug, project_id):
        """List pages

        Retrieve all pages in a project.
        Returns paginated results.
        """
        return self.paginate(
            request=request,
            queryset=(self.get_queryset().order_by("-created_at")),
            on_results=lambda pages: PageSerializer(pages, many=True, fields=self.fields, expand=self.expand).data,
        )


class PageDetailAPIEndpoint(BaseAPIView):
    """Page Detail Endpoint"""

    serializer_class = PageSerializer
    model = Page
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            Page.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(
                projects__id=self.kwargs.get("project_id"),
                project_pages__deleted_at__isnull=True,
            )
            .filter(
                projects__project_projectmember__member=self.request.user,
                projects__project_projectmember__is_active=True,
            )
            .filter(projects__archived_at__isnull=True)
            .filter(Q(owned_by=self.request.user) | Q(access=Page.PUBLIC_ACCESS))
            .select_related("workspace")
            .select_related("owned_by")
            .distinct()
        )

    @page_docs(
        operation_id="retrieve_page",
        summary="Retrieve page",
        description="Retrieve details of a specific page.",
        responses={
            200: OpenApiResponse(
                description="Page retrieved",
                response=PageSerializer,
            ),
        },
    )
    def get(self, request, slug, project_id, page_id):
        """Retrieve page

        Retrieve details of a specific page.
        """
        serializer = PageSerializer(
            self.get_queryset().get(pk=page_id),
            fields=self.fields,
            expand=self.expand,
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    @page_docs(
        operation_id="update_page",
        summary="Update page",
        description="Partially update an existing page's properties like name or HTML description.",
        request=OpenApiRequest(request=PageSerializer),
        responses={
            200: OpenApiResponse(
                description="Page updated",
                response=PageSerializer,
            ),
            400: INVALID_REQUEST_RESPONSE,
            409: EXTERNAL_ID_EXISTS_RESPONSE,
        },
    )
    def patch(self, request, slug, project_id, page_id):
        """Update page

        Partially update an existing page's properties like name or HTML description.
        Validates external ID uniqueness if provided.
        """
        page = self.get_queryset().get(pk=page_id)

        if page.is_locked:
            return Response({"error": "Page is locked"}, status=status.HTTP_400_BAD_REQUEST)

        # Only update access if the page owner is the requesting user
        if page.access != request.data.get("access", page.access) and page.owned_by_id != request.user.id:
            return Response(
                {"error": "Access cannot be updated since this page is owned by someone else"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PageSerializer(page, data=request.data, partial=True)
        if serializer.is_valid():
            if (
                request.data.get("external_id")
                and (page.external_id != str(request.data.get("external_id")))
                and Page.objects.filter(
                    workspace__slug=slug,
                    projects__id=project_id,
                    external_source=request.data.get("external_source", page.external_source),
                    external_id=request.data.get("external_id"),
                ).exists()
            ):
                return Response(
                    {
                        "error": "Page with the same external id and external source already exists",
                        "id": str(page.id),
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            parent = serializer.validated_data.get("parent")
            if parent and not Page.objects.filter(
                pk=parent.id, workspace__slug=slug, projects__id=project_id
            ).exists():
                return Response(
                    {"error": "Parent page does not exist in the project"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
