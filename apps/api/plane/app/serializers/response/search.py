# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers


class SearchWorkspaceSerializer(serializers.Serializer):
    name = serializers.CharField()
    id = serializers.UUIDField()
    slug = serializers.CharField()


class SearchProjectSerializer(serializers.Serializer):
    name = serializers.CharField()
    id = serializers.UUIDField()
    identifier = serializers.CharField()
    workspace__slug = serializers.CharField()


class SearchWorkItemSerializer(serializers.Serializer):
    name = serializers.CharField()
    id = serializers.UUIDField()
    sequence_id = serializers.IntegerField()
    project__identifier = serializers.CharField()
    project_id = serializers.UUIDField()
    workspace__slug = serializers.CharField()


class SearchProjectEntitySerializer(serializers.Serializer):
    name = serializers.CharField()
    id = serializers.UUIDField()
    project_id = serializers.UUIDField()
    project__identifier = serializers.CharField()
    workspace__slug = serializers.CharField()


class SearchPageSerializer(serializers.Serializer):
    name = serializers.CharField()
    id = serializers.UUIDField()
    project_ids = serializers.ListField(child=serializers.UUIDField(), allow_null=True)
    project_identifiers = serializers.ListField(child=serializers.CharField(), allow_null=True)
    workspace__slug = serializers.CharField()


class GlobalSearchResultsSerializer(serializers.Serializer):
    """Only the requested entities are present."""

    workspace = SearchWorkspaceSerializer(many=True)
    project = SearchProjectSerializer(many=True)
    issue = SearchWorkItemSerializer(many=True)
    cycle = SearchProjectEntitySerializer(many=True)
    module = SearchProjectEntitySerializer(many=True)
    issue_view = SearchProjectEntitySerializer(many=True)
    page = SearchPageSerializer(many=True)
    intake = SearchWorkItemSerializer(many=True)

    class Meta:
        response_optional = ("workspace", "project", "issue", "cycle", "module", "issue_view", "page", "intake")


class GlobalSearchSerializer(serializers.Serializer):
    results = GlobalSearchResultsSerializer()


class MentionSerializer(serializers.Serializer):
    member__avatar_url = serializers.CharField(allow_null=True)
    member__display_name = serializers.CharField()
    member__id = serializers.UUIDField()
    is_project_member = serializers.BooleanField(help_text="Present when project_id is given")

    class Meta:
        response_optional = ("is_project_member",)


class EntitySearchProjectSerializer(serializers.Serializer):
    name = serializers.CharField()
    id = serializers.UUIDField()
    identifier = serializers.CharField()
    logo_props = serializers.JSONField()
    workspace__slug = serializers.CharField()


class EntitySearchWorkItemSerializer(serializers.Serializer):
    name = serializers.CharField()
    id = serializers.UUIDField()
    sequence_id = serializers.IntegerField()
    project__identifier = serializers.CharField()
    project_id = serializers.UUIDField()
    priority = serializers.CharField()
    state_id = serializers.UUIDField(allow_null=True)
    type_id = serializers.UUIDField()


class EntitySearchPlanSerializer(serializers.Serializer):
    name = serializers.CharField()
    id = serializers.UUIDField()
    project_id = serializers.UUIDField()
    project__identifier = serializers.CharField()
    status = serializers.CharField(allow_null=True)
    workspace__slug = serializers.CharField()


class EntitySearchPageSerializer(serializers.Serializer):
    name = serializers.CharField()
    id = serializers.UUIDField()
    logo_props = serializers.JSONField()
    projects__id = serializers.UUIDField(allow_null=True)
    workspace__slug = serializers.CharField()


class EntitySearchSerializer(serializers.Serializer):
    """One key per requested query_type."""

    user_mention = MentionSerializer(many=True)
    project = EntitySearchProjectSerializer(many=True)
    issue = EntitySearchWorkItemSerializer(many=True)
    cycle = EntitySearchPlanSerializer(many=True)
    module = EntitySearchPlanSerializer(many=True)
    page = EntitySearchPageSerializer(many=True)

    class Meta:
        response_optional = ("user_mention", "project", "issue", "cycle", "module", "page")
