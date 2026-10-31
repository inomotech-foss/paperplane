# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third Party imports
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema

# Module imports
from plane.app.serializers.response.public import PublicMemberSerializer
from .base import BaseAPIView
from plane.app.serializers import DeployBoardSerializer
from plane.db.models import DeployBoard, ProjectMember


class ProjectDeployBoardPublicSettingsEndpoint(BaseAPIView):
    permission_classes = [AllowAny]

    @extend_schema(responses={200: DeployBoardSerializer})
    def get(self, request, anchor):
        project_deploy_board = DeployBoard.objects.get(anchor=anchor, entity_name="project")
        serializer = DeployBoardSerializer(project_deploy_board)
        return Response(serializer.data, status=status.HTTP_200_OK)


class WorkspaceProjectAnchorEndpoint(BaseAPIView):
    permission_classes = [AllowAny]

    @extend_schema(responses={200: DeployBoardSerializer})
    def get(self, request, slug, project_id):
        project_deploy_board = DeployBoard.objects.get(
            workspace__slug=slug, project_id=project_id, entity_identifier=project_id, entity_name="project"
        )
        serializer = DeployBoardSerializer(project_deploy_board)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProjectMembersEndpoint(BaseAPIView):
    permission_classes = [AllowAny]

    @extend_schema(responses={200: PublicMemberSerializer(many=True)})
    def get(self, request, anchor):
        deploy_board = DeployBoard.objects.filter(anchor=anchor).first()
        if not deploy_board:
            return Response(
                {"error": "Invalid anchor"},
                status=status.HTTP_404_NOT_FOUND,
            )

        members = ProjectMember.objects.filter(
            project=deploy_board.project,
            workspace=deploy_board.workspace,
            is_active=True,
        ).values(
            "id",
            "member",
            "member__display_name",
            "member__avatar",
        )
        return Response(members, status=status.HTTP_200_OK)
