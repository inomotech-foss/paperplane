# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.space.serializer.project import ProjectLiteSerializer
from plane.utils.openapi.pagination import paginated_union


class PublicNamedSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()


class PublicLabelSerializer(PublicNamedSerializer):
    color = serializers.CharField()
    parent = serializers.UUIDField(allow_null=True)


class PublicStateSerializer(PublicNamedSerializer):
    group = serializers.CharField()
    color = serializers.CharField()
    sequence = serializers.FloatField()


class PublicMemberSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    member = serializers.UUIDField()
    member__display_name = serializers.CharField()
    member__avatar = serializers.CharField(allow_null=True)


class PublicActorSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    avatar = serializers.CharField(allow_null=True)
    avatar_url = serializers.CharField(allow_null=True)
    display_name = serializers.CharField()


class PublicVoteSerializer(serializers.Serializer):
    vote = serializers.IntegerField()
    actor_details = PublicActorSerializer()


class PublicReactionSerializer(serializers.Serializer):
    reaction = serializers.CharField()
    actor_details = PublicActorSerializer()


class PublicWorkItemSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    state_id = serializers.UUIDField(allow_null=True)
    sort_order = serializers.FloatField()
    description_json = serializers.JSONField()
    description_html = serializers.CharField()
    description_stripped = serializers.CharField(allow_null=True)
    description_binary = serializers.CharField(allow_null=True)
    module_ids = serializers.ListField(child=serializers.UUIDField())
    label_ids = serializers.ListField(child=serializers.UUIDField())
    assignee_ids = serializers.ListField(child=serializers.UUIDField())
    estimate_point = serializers.UUIDField(allow_null=True)
    priority = serializers.CharField()
    start_date = serializers.DateField(allow_null=True)
    target_date = serializers.DateField(allow_null=True)
    sequence_id = serializers.IntegerField()
    project_id = serializers.UUIDField()
    parent_id = serializers.UUIDField(allow_null=True)
    cycle_id = serializers.UUIDField(allow_null=True)
    created_by = serializers.UUIDField(allow_null=True)
    state__group = serializers.CharField(allow_null=True)
    vote_items = PublicVoteSerializer(many=True, allow_null=True)
    reaction_items = PublicReactionSerializer(many=True, allow_null=True)


class PublicProjectMetaSerializer(ProjectLiteSerializer):
    """The space app's own ProjectLiteSerializer, named apart from the app one."""


class PublicWorkItemListItemSerializer(serializers.Serializer):
    """A row of the published board. Grouping by labels, assignees or modules swaps the id list for the group key."""

    id = serializers.UUIDField()
    name = serializers.CharField()
    state_id = serializers.UUIDField(allow_null=True)
    sort_order = serializers.FloatField()
    estimate_point = serializers.UUIDField(allow_null=True)
    priority = serializers.CharField()
    start_date = serializers.DateField(allow_null=True)
    target_date = serializers.DateField(allow_null=True)
    sequence_id = serializers.IntegerField()
    project_id = serializers.UUIDField()
    parent_id = serializers.UUIDField(allow_null=True)
    cycle_id = serializers.UUIDField(allow_null=True)
    created_by = serializers.UUIDField(allow_null=True)
    state__group = serializers.CharField(allow_null=True)
    assignee_ids = serializers.ListField(child=serializers.UUIDField())
    label_ids = serializers.ListField(child=serializers.UUIDField())
    module_ids = serializers.ListField(child=serializers.UUIDField())
    labels__id = serializers.UUIDField(allow_null=True)
    assignees__id = serializers.UUIDField(allow_null=True)
    issue_module__module_id = serializers.UUIDField(allow_null=True)
    vote_items = PublicVoteSerializer(many=True, allow_null=True)
    reaction_items = PublicReactionSerializer(many=True, allow_null=True)

    class Meta:
        response_optional = (
            "assignee_ids",
            "label_ids",
            "module_ids",
            "labels__id",
            "assignees__id",
            "issue_module__module_id",
        )


PublicWorkItemListResponse = paginated_union(PublicWorkItemListItemSerializer, name="PublicWorkItem")
