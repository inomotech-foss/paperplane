# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Schema-only serializers that describe response bodies the admin views build by hand."""

from drf_spectacular.utils import PolymorphicProxySerializer
from rest_framework import serializers

from .admin import InstanceAdminMeSerializer
from .instance import InstanceSerializer


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


class InstanceDetailSerializer(InstanceSerializer):
    workspaces_exist = serializers.BooleanField()


class InstanceConfigSerializer(serializers.Serializer):
    enable_signup = serializers.BooleanField()
    is_workspace_creation_disabled = serializers.BooleanField()
    is_google_enabled = serializers.BooleanField()
    is_github_enabled = serializers.BooleanField()
    is_gitlab_enabled = serializers.BooleanField()
    is_gitea_enabled = serializers.BooleanField()
    is_oidc_enabled = serializers.BooleanField()
    oidc_provider_name = serializers.CharField()
    is_magic_login_enabled = serializers.BooleanField()
    is_email_password_enabled = serializers.BooleanField()
    github_app_name = serializers.CharField()
    slack_client_id = serializers.CharField(allow_null=True)
    has_unsplash_configured = serializers.BooleanField()
    has_llm_configured = serializers.BooleanField()
    file_size_limit = serializers.FloatField()
    is_smtp_configured = serializers.BooleanField()
    admin_base_url = serializers.CharField(allow_null=True)
    space_base_url = serializers.CharField(allow_null=True)
    app_base_url = serializers.CharField(allow_null=True)
    instance_changelog_url = serializers.CharField(allow_null=True)
    diagram_embed_origin = serializers.CharField(allow_null=True)
    external_embed_allowed_origins = serializers.ListField(child=serializers.CharField())
    is_self_managed = serializers.BooleanField()


class InstanceInfoSerializer(serializers.Serializer):
    config = InstanceConfigSerializer()
    instance = InstanceDetailSerializer()


class UnregisteredInstanceSerializer(serializers.Serializer):
    is_activated = serializers.BooleanField()
    is_setup_done = serializers.BooleanField()


InstanceInfoResponse = PolymorphicProxySerializer(
    component_name="InstanceInfoResponse",
    serializers=[InstanceInfoSerializer, UnregisteredInstanceSerializer],
    resource_type_field_name=None,
    many=False,
    help_text="Only the two flags before the instance is registered",
)


class OAuthApplicationSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    client_id = serializers.CharField()
    redirect_uris = serializers.CharField(help_text="Space separated")
    installations = serializers.IntegerField()
    managed = serializers.BooleanField(help_text="True when the Helm chart owns the application")
    created = serializers.DateTimeField()


class CreatedOAuthApplicationSerializer(OAuthApplicationSerializer):
    client_secret = serializers.CharField(help_text="Shown once, it cannot be read again")
