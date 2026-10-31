# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.utils import OpenApiResponse, extend_schema_field
from rest_framework import serializers

from plane.app.serializers import FileAssetSerializer, IssueAttachmentSerializer
from plane.app.serializers.page import PageAttachmentSerializer

REDIRECT = OpenApiResponse(description="Redirect to a signed storage URL")


# A raw schema: a serializer cannot declare a field called "fields".
@extend_schema_field(
    {
        "type": "object",
        "properties": {
            "url": {"type": "string"},
            "fields": {
                "type": "object",
                "additionalProperties": {"type": "string"},
                "description": "Form fields to send with the file",
            },
        },
        "required": ["url", "fields"],
    }
)
class PresignedPostField(serializers.JSONField):
    pass


class AssetUploadSerializer(serializers.Serializer):
    upload_data = PresignedPostField(allow_null=True, help_text="Null when storage could not sign the upload")
    asset_id = serializers.UUIDField()
    asset_url = serializers.CharField(allow_null=True)


class IssueAttachmentUploadSerializer(AssetUploadSerializer):
    attachment = IssueAttachmentSerializer()


class PageAttachmentUploadSerializer(AssetUploadSerializer):
    attachment = PageAttachmentSerializer()


class AssetExistsSerializer(serializers.Serializer):
    exists = serializers.BooleanField()


class DuplicatedAssetSerializer(serializers.Serializer):
    asset_id = serializers.UUIDField()


class FileAssetLookupSerializer(serializers.Serializer):
    status = serializers.BooleanField(help_text="False when no asset has the key")
    data = FileAssetSerializer(many=True)
    error = serializers.CharField()

    class Meta:
        response_optional = ("data", "error")
