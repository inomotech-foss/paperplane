# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.utils import PolymorphicProxySerializer
from rest_framework import serializers

from plane.app.serializers import ProjectMemberSerializer, UserMeSerializer, WorkSpaceSerializer
from plane.utils.openapi.serializers import EmptyObjectSerializer


class UserSessionSerializer(serializers.Serializer):
    is_authenticated = serializers.BooleanField()
    user = UserMeSerializer(required=False, help_text="Present when authenticated")


class InstanceAdminStatusSerializer(serializers.Serializer):
    is_instance_admin = serializers.BooleanField()


class ConnectedAppWorkspaceSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    slug = serializers.CharField()


class ConnectedAppSerializer(serializers.Serializer):
    id = serializers.IntegerField(help_text="OAuth application id")
    name = serializers.CharField()
    connected_at = serializers.DateTimeField(help_text="When access was first granted")
    workspaces = ConnectedAppWorkspaceSerializer(many=True)


class LastVisitedWorkspaceSerializer(serializers.Serializer):
    workspace_details = PolymorphicProxySerializer(
        component_name="LastVisitedWorkspaceDetails",
        serializers=[WorkSpaceSerializer, EmptyObjectSerializer],
        resource_type_field_name=None,
        help_text="An empty object when the user has no last workspace",
    )
    project_details = ProjectMemberSerializer(many=True)
