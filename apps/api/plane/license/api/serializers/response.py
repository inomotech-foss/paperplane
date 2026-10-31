# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Schema-only serializers that describe response bodies the admin views build by hand."""

from rest_framework import serializers

from .admin import InstanceAdminMeSerializer


class InstanceAdminSessionSerializer(serializers.Serializer):
    is_authenticated = serializers.BooleanField()
    user = InstanceAdminMeSerializer(required=False, help_text="Present when signed in as an instance admin")


class InstanceUserSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    email = serializers.EmailField()
    display_name = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    avatar_url = serializers.CharField(allow_null=True)
    is_active = serializers.BooleanField()
    is_bot = serializers.BooleanField()
    deleted_at = serializers.DateTimeField(allow_null=True)
    merged_into = serializers.UUIDField(allow_null=True)
    is_instance_admin = serializers.BooleanField()
    providers = serializers.ListField(child=serializers.CharField())
    workspace_count = serializers.IntegerField()
    last_login_time = serializers.DateTimeField(allow_null=True)
    date_joined = serializers.DateTimeField()


class InstanceUserMembershipSerializer(serializers.Serializer):
    workspace_id = serializers.UUIDField()
    slug = serializers.CharField()
    name = serializers.CharField()
    role = serializers.IntegerField()
    is_active = serializers.BooleanField()


class InstanceUserOwnedWorkspaceSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    slug = serializers.CharField()
    name = serializers.CharField()


class InstanceUserDetailSerializer(InstanceUserSerializer):
    memberships = InstanceUserMembershipSerializer(many=True)
    owned_workspaces = InstanceUserOwnedWorkspaceSerializer(many=True)


class SoleAdminProjectSerializer(serializers.Serializer):
    workspace = serializers.CharField(help_text="Workspace slug")
    name = serializers.CharField()


class InstanceUserDeactivateSerializer(serializers.Serializer):
    sole_admin_workspaces = serializers.ListField(
        child=serializers.CharField(), help_text="Slugs of the workspaces the user was the only admin of"
    )
    sole_admin_projects = SoleAdminProjectSerializer(many=True)
    user = InstanceUserSerializer()


class InstanceUserReactivateSerializer(serializers.Serializer):
    user = InstanceUserSerializer()


class MergeCountSerializer(serializers.Serializer):
    moved = serializers.IntegerField()
    dropped = serializers.IntegerField()


class InstanceUserMergeSerializer(serializers.Serializer):
    survivor = serializers.UUIDField()
    source = serializers.UUIDField()
    email = serializers.EmailField(help_text="Email of the surviving user after the merge")
    relations = serializers.DictField(
        child=MergeCountSerializer(), help_text="Rows moved and dropped, keyed by app.Model.field"
    )
