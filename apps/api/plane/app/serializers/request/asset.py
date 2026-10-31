# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers

from plane.app.serializers.request.issue_detail import AttachmentUploadSerializer
from plane.db.models import FileAsset


class AssetCreateSerializer(AttachmentUploadSerializer):
    entity_type = serializers.ChoiceField(
        choices=FileAsset.EntityTypeContext.choices, help_text="Each endpoint accepts a subset"
    )
    entity_identifier = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, help_text="The entity the asset belongs to, if it exists"
    )


class AssetAttributesSerializer(serializers.Serializer):
    attributes = serializers.JSONField(required=False, help_text="Replaces the stored attributes when sent")


class AssetIdsSerializer(serializers.Serializer):
    asset_ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)


class AssetDuplicateSerializer(serializers.Serializer):
    entity_type = serializers.ChoiceField(choices=FileAsset.EntityTypeContext.choices)
    entity_id = serializers.UUIDField(required=False, allow_null=True)
    project_id = serializers.UUIDField(required=False, allow_null=True)


def _query(name, description, type=OpenApiTypes.STR):
    return OpenApiParameter(
        name=name, description=description, type=type, location=OpenApiParameter.QUERY, required=False
    )


UNSPLASH_PARAMETERS = [
    _query("query", "Search for this. The latest photos when omitted"),
    _query("page", "1 when omitted", OpenApiTypes.INT),
    _query("per_page", "20 when omitted", OpenApiTypes.INT),
]
