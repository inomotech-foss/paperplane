# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.utils import PolymorphicProxySerializer
from rest_framework import serializers

from plane.app.serializers import (
    DeployBoardSerializer,
    LabelSerializer,
    ProjectListSerializer,
    ProjectMemberAdminSerializer,
    ProjectMemberRoleSerializer,
    ProjectMemberSerializer,
)
from plane.utils.openapi.pagination import paginated_response

PERSONAL_MEMBER_FIELDS = ("preferences", "view_props", "default_props")


class ProjectListItemSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    identifier = serializers.CharField()
    sort_order = serializers.FloatField(allow_null=True)
    logo_props = serializers.JSONField()
    member_role = serializers.IntegerField(allow_null=True)
    intake_count = serializers.IntegerField()
    archived_at = serializers.DateTimeField(allow_null=True)
    workspace = serializers.UUIDField()
    cycle_view = serializers.BooleanField()
    issue_views_view = serializers.BooleanField()
    module_view = serializers.BooleanField()
    page_view = serializers.BooleanField()
    issue_view = serializers.BooleanField()
    inbox_view = serializers.BooleanField()
    guest_view_all_features = serializers.BooleanField()
    project_lead = serializers.UUIDField(allow_null=True)
    network = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    created_by = serializers.UUIDField(allow_null=True)
    updated_by = serializers.UUIDField(allow_null=True)


ProjectListDetailResponse = PolymorphicProxySerializer(
    component_name="ProjectListDetailResponse",
    serializers=[
        ProjectListSerializer(many=True),
        paginated_response(ProjectListSerializer),
    ],
    resource_type_field_name=None,
    many=False,
    help_text="Paginated when both cursor and per_page are given",
)


class ProjectArchiveSerializer(serializers.Serializer):
    archived_at = serializers.CharField()


class IssueSequenceSerializer(serializers.Serializer):
    last_sequence = serializers.IntegerField()
    next_sequence = serializers.IntegerField()


class ProjectIdentifierRowSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    project = serializers.UUIDField()


class ProjectIdentifierCheckSerializer(serializers.Serializer):
    exists = serializers.IntegerField(help_text="Number of matching identifiers")
    identifiers = ProjectIdentifierRowSerializer(many=True)


class ProjectStatsSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    total_issues = serializers.IntegerField(required=False, allow_null=True)
    completed_issues = serializers.IntegerField(required=False, allow_null=True)
    total_members = serializers.IntegerField(required=False, allow_null=True)
    total_cycles = serializers.IntegerField(required=False, allow_null=True)
    total_modules = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        response_optional = ("total_issues", "completed_issues", "total_members", "total_cycles", "total_modules")


class BulkLabelsSerializer(serializers.Serializer):
    labels = LabelSerializer(many=True)


class ProjectMemberPreferencesSerializer(serializers.Serializer):
    preferences = serializers.JSONField()


class ProjectMemberAdminDetailSerializer(ProjectMemberAdminSerializer):
    class Meta(ProjectMemberAdminSerializer.Meta):
        response_optional = PERSONAL_MEMBER_FIELDS


class ProjectMemberDetailSerializer(ProjectMemberSerializer):
    class Meta(ProjectMemberSerializer.Meta):
        response_optional = PERSONAL_MEMBER_FIELDS


ProjectMemberRetrieveResponse = PolymorphicProxySerializer(
    component_name="ProjectMemberRetrieveResponse",
    serializers=[ProjectMemberAdminDetailSerializer, ProjectMemberRoleSerializer],
    resource_type_field_name=None,
    help_text="Guests get the role view. Personal fields are only present for the caller's own membership.",
)


class UnpublishedDeployBoardSerializer(serializers.Serializer):
    """The serializer defaults DRF returns when the project has no deploy board."""

    deleted_at = serializers.DateTimeField(allow_null=True)
    is_comments_enabled = serializers.BooleanField()
    is_reactions_enabled = serializers.BooleanField()
    is_votes_enabled = serializers.BooleanField()
    view_props = serializers.JSONField(allow_null=True)
    is_activity_enabled = serializers.BooleanField()
    is_disabled = serializers.BooleanField()
    created_by = serializers.UUIDField(allow_null=True)
    updated_by = serializers.UUIDField(allow_null=True)
    intake = serializers.UUIDField(allow_null=True)
    intake_issue_type = serializers.UUIDField(allow_null=True)


ProjectDeployBoardResponse = PolymorphicProxySerializer(
    component_name="ProjectDeployBoardResponse",
    serializers=[DeployBoardSerializer, UnpublishedDeployBoardSerializer],
    resource_type_field_name=None,
    many=False,
    help_text="The defaults without an id when the project is not published",
)
