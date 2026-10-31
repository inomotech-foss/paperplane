# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.response import Response
from rest_framework import status

# Module imports
from plane.app.views.base import BaseViewSet
from plane.app.permissions import ROLE, allow_permission
from plane.db.models import Sticky, Workspace
from plane.app.serializers import StickySerializer
from plane.utils.openapi import CURSOR_PARAMETER, PER_PAGE_PARAMETER
from plane.utils.openapi.pagination import paginated_response

STICKY_QUERY_PARAMETER = OpenApiParameter(
    name="query",
    description="Only stickies whose text contains this. Every sticky when omitted",
    type=OpenApiTypes.STR,
    location=OpenApiParameter.QUERY,
    required=False,
)


class WorkspaceStickyViewSet(BaseViewSet):
    serializer_class = StickySerializer
    model = Sticky
    use_read_replica = True

    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(owner_id=self.request.user.id)
            .select_related("workspace", "owner")
            .distinct()
        )

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def create(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        serializer = StickySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace_id=workspace.id, owner_id=request.user.id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        parameters=[CURSOR_PARAMETER, PER_PAGE_PARAMETER, STICKY_QUERY_PARAMETER],
        filters=False,
        responses={200: paginated_response(StickySerializer)},
    )
    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def list(self, request, slug):
        query = request.query_params.get("query", False)
        stickies = self.get_queryset().order_by("-sort_order")
        if query:
            stickies = stickies.filter(description_stripped__icontains=query)

        return self.paginate(
            request=request,
            queryset=(stickies),
            on_results=lambda stickies: StickySerializer(stickies, many=True).data,
            default_per_page=20,
        )

    @allow_permission(allowed_roles=[], creator=True, model=Sticky, level="WORKSPACE")
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    @allow_permission(allowed_roles=[], creator=True, model=Sticky, level="WORKSPACE")
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)
