# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Max
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import ProjectLinkSerializer
from plane.app.views.base import BaseAPIView
from plane.db.models import ProjectLink

SORT_ORDER_STEP = 1000


class ProjectLinkEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        links = ProjectLink.objects.filter(workspace__slug=slug, project_id=project_id)
        return Response(ProjectLinkSerializer(links, many=True).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def post(self, request, slug, project_id):
        serializer = ProjectLinkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        last = ProjectLink.objects.filter(project_id=project_id).aggregate(last=Max("sort_order"))["last"]
        sort_order = SORT_ORDER_STEP if last is None else last + SORT_ORDER_STEP
        serializer.save(project_id=project_id, sort_order=sort_order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ProjectLinkDetailEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN])
    def patch(self, request, slug, project_id, pk):
        link = ProjectLink.objects.get(workspace__slug=slug, project_id=project_id, pk=pk)
        serializer = ProjectLinkSerializer(link, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def delete(self, request, slug, project_id, pk):
        link = ProjectLink.objects.get(workspace__slug=slug, project_id=project_id, pk=pk)
        link.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectLinkReorderEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN])
    def post(self, request, slug, project_id):
        link_ids = request.data.get("link_ids")
        if not isinstance(link_ids, list) or not all(isinstance(link_id, str) for link_id in link_ids):
            return Response({"error": "link_ids must be a list of ids."}, status=status.HTTP_400_BAD_REQUEST)

        links = {str(link.id): link for link in ProjectLink.objects.filter(project_id=project_id)}
        if len(link_ids) != len(set(link_ids)) or set(link_ids) != set(links):
            return Response(
                {"error": "link_ids must list every link of the project exactly once."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        ordered = [links[link_id] for link_id in link_ids]
        for index, link in enumerate(ordered):
            link.sort_order = (index + 1) * SORT_ORDER_STEP
            link.updated_at = now
            link.updated_by = request.user
        ProjectLink.objects.bulk_update(ordered, ["sort_order", "updated_at", "updated_by"])

        return Response(ProjectLinkSerializer(ordered, many=True).data, status=status.HTTP_200_OK)


class WorkspaceProjectLinkEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug):
        links = ProjectLink.objects.filter(
            workspace__slug=slug,
            project__archived_at__isnull=True,
            project__project_projectmember__member=request.user,
            project__project_projectmember__is_active=True,
            project__project_projectmember__deleted_at__isnull=True,
        ).distinct()
        return Response(ProjectLinkSerializer(links, many=True).data, status=status.HTTP_200_OK)
