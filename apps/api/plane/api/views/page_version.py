# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import transaction
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiResponse, OpenApiRequest

# Module imports
from plane.api.serializers.page_version import (
    PageVersionSerializer,
    PageVersionDetailSerializer,
    PageVersionCreateSerializer,
)
from plane.app.permissions import ProjectEntityPermission
from plane.db.models import Page, PageVersion
from plane.utils.html_processor import strip_tags
from plane.utils.openapi import (
    page_docs,
    CURSOR_PARAMETER,
    PER_PAGE_PARAMETER,
    FIELDS_PARAMETER,
    EXPAND_PARAMETER,
    create_paginated_response,
    INVALID_REQUEST_RESPONSE,
)
from .base import BaseAPIView


class PageVersionListCreateAPIEndpoint(BaseAPIView):
    """Page Version List and History Import Endpoint"""

    serializer_class = PageVersionSerializer
    model = PageVersion
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            PageVersion.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(page_id=self.kwargs.get("page_id"))
            # Scope to an *active* ProjectPage link for the URL project, so a page
            # belonging to (or removed from) another project cannot be read here
            # (GHSA-g49r / GHSA-ghcr).
            .filter(
                page__project_pages__project_id=self.kwargs.get("project_id"),
                page__project_pages__deleted_at__isnull=True,
            )
            .filter(
                page__projects__project_projectmember__member=self.request.user,
                page__projects__project_projectmember__is_active=True,
            )
            .select_related("workspace", "page", "owned_by")
            .distinct()
        )

    @page_docs(
        operation_id="list_page_versions",
        summary="List page versions",
        description=(
            "Retrieve the saved versions of a page, newest first. Bodies are omitted; "
            "fetch a single version for its content."
        ),
        parameters=[
            CURSOR_PARAMETER,
            PER_PAGE_PARAMETER,
            FIELDS_PARAMETER,
            EXPAND_PARAMETER,
        ],
        responses={
            200: create_paginated_response(
                PageVersionSerializer,
                "PaginatedPageVersionResponse",
                "Paginated list of page versions",
                "Paginated Page Versions",
            ),
        },
    )
    def get(self, request, slug, project_id, page_id):
        """List page versions

        Retrieve the version history of a page, newest first.
        Returns paginated results without the version bodies.
        """
        return self.paginate(
            request=request,
            queryset=self.get_queryset().order_by("-last_saved_at"),
            on_results=lambda versions: (
                PageVersionSerializer(versions, many=True, fields=self.fields, expand=self.expand).data
            ),
        )

    @page_docs(
        operation_id="import_page_versions",
        summary="Import page versions",
        description=(
            "Import historical versions onto a page, preserving the original "
            "timestamps and authors. Intended for migrations from another wiki: "
            "accepts a single version or a batch under `versions`, and skips any "
            "entry whose external_source/external_id pair is already present."
        ),
        request=OpenApiRequest(request=PageVersionCreateSerializer),
        responses={
            201: OpenApiResponse(description="Versions imported", response=PageVersionSerializer),
            400: INVALID_REQUEST_RESPONSE,
            404: OpenApiResponse(description="Page not found"),
        },
    )
    def post(self, request, slug, project_id, page_id):
        """Import page versions

        Write history that was made elsewhere. Unlike an edit through the API this
        creates no activity and no notification, and it does not touch the page
        itself — a migration replays a page's whole past and must not announce it
        or overwrite the current body.
        """
        payload = request.data.get("versions") if isinstance(request.data, dict) else request.data
        if payload is None:
            payload = [request.data]
        if not isinstance(payload, list):
            return Response({"error": "versions must be a list"}, status=status.HTTP_400_BAD_REQUEST)
        if not payload:
            return Response({"created": 0, "skipped": 0, "versions": []}, status=status.HTTP_201_CREATED)

        page = Page.objects.filter(pk=page_id, workspace__slug=slug, projects__id=project_id).first()
        if not page:
            return Response({"error": "Page does not exist"}, status=status.HTTP_404_NOT_FOUND)

        # one query for the whole batch instead of one per entry
        incoming = {
            (v.get("external_source"), str(v.get("external_id")))
            for v in payload
            if isinstance(v, dict) and v.get("external_source") and v.get("external_id")
        }
        already = set()
        if incoming:
            already = {
                (src, str(ext))
                for src, ext in PageVersion.objects.filter(
                    page_id=page_id,
                    external_source__in={s for s, _ in incoming},
                    external_id__in={e for _, e in incoming},
                ).values_list("external_source", "external_id")
            }

        to_create, stamps, skipped, seen = [], [], 0, set()
        for entry in payload:
            if not isinstance(entry, dict):
                return Response({"error": "each version must be an object"}, status=status.HTTP_400_BAD_REQUEST)
            key = (entry.get("external_source"), str(entry.get("external_id")))
            # skip what is already stored, and de-duplicate within the batch itself
            if all(key) and (key in already or key in seen):
                skipped += 1
                continue
            serializer = PageVersionCreateSerializer(data=entry)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            if all(key):
                seen.add(key)
            data = serializer.validated_data
            last_saved_at = data.pop("last_saved_at", None)
            created_at = data.pop("created_at", None) or last_saved_at or timezone.now()
            description_html = data.pop("description_html")
            # an unmapped author still has to belong to someone: the page owner
            owned_by = data.pop("owned_by", None) or page.owned_by
            to_create.append(
                PageVersion(
                    **data,
                    page_id=page.id,
                    workspace_id=page.workspace_id,
                    owned_by=owned_by,
                    last_saved_at=last_saved_at or created_at,
                    description_html=description_html,
                    # bulk_create skips save(), which is what normally derives this
                    description_stripped=strip_tags(description_html),
                )
            )
            stamps.append(created_at)

        created = []
        if to_create:
            with transaction.atomic():
                created = PageVersion.objects.bulk_create(to_create, batch_size=100)
                # created_at is auto_now_add: the insert stamps "now" onto the row AND
                # onto the in-memory instance, so the original has to be kept aside
                # (in `stamps`) and written back in a second pass.
                for obj, original in zip(created, stamps):
                    obj.created_at = original
                PageVersion.objects.bulk_update(created, ["created_at"], batch_size=100)

        return Response(
            {
                "created": len(created),
                "skipped": skipped,
                "versions": PageVersionSerializer(created, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )


class PageVersionDetailAPIEndpoint(BaseAPIView):
    """Page Version Detail Endpoint"""

    serializer_class = PageVersionDetailSerializer
    model = PageVersion
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            PageVersion.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(page_id=self.kwargs.get("page_id"))
            .filter(
                page__project_pages__project_id=self.kwargs.get("project_id"),
                page__project_pages__deleted_at__isnull=True,
            )
            .filter(
                page__projects__project_projectmember__member=self.request.user,
                page__projects__project_projectmember__is_active=True,
            )
            .select_related("workspace", "page", "owned_by")
            .distinct()
        )

    @page_docs(
        operation_id="retrieve_page_version",
        summary="Retrieve page version",
        description="Retrieve a single saved version of a page, including the body it captured.",
        responses={
            200: OpenApiResponse(description="Page version retrieved", response=PageVersionDetailSerializer),
        },
    )
    def get(self, request, slug, project_id, page_id, pk):
        """Retrieve page version

        Retrieve a single saved version of a page, including its body.
        """
        serializer = PageVersionDetailSerializer(
            self.get_queryset().get(pk=pk),
            fields=self.fields,
            expand=self.expand,
        )
        return Response(serializer.data, status=status.HTTP_200_OK)
