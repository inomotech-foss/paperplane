# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers


class FavoriteUpdateSerializer(serializers.Serializer):
    """The fields of a favorite that can change. The favorited entity stays fixed."""

    name = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    sequence = serializers.FloatField(required=False)
    parent = serializers.UUIDField(required=False, allow_null=True, help_text="The folder that holds the favorite")


class FavoriteCreateSerializer(FavoriteUpdateSerializer):
    entity_type = serializers.CharField(help_text="project, cycle, module, view, page or folder")
    entity_identifier = serializers.UUIDField(
        required=False, allow_null=True, help_text="The favorited entity. Omitted for a folder"
    )
    is_folder = serializers.BooleanField(required=False)
    project_id = serializers.UUIDField(
        required=False, allow_null=True, help_text="The project of the entity. Null for workspace views and folders"
    )
