# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Schema-only serializers for request bodies that the admin views read by hand."""

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers


class InstanceUserMergeRequestSerializer(serializers.Serializer):
    source = serializers.UUIDField(help_text="The user merged into the survivor")
    keep_source_email = serializers.BooleanField(required=False, help_text="False when omitted")


class InstanceWorkspaceTransferOwnerSerializer(serializers.Serializer):
    owner = serializers.UUIDField(help_text="An active, non-bot user")


def _flag(name, description):
    return OpenApiParameter(name=name, type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, description=description)


INSTANCE_USER_LIST_PARAMETERS = [
    OpenApiParameter(
        name="search",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        description="Matches email, display name, first or last name",
    ),
    _flag("is_active", "true or false, both when omitted"),
    _flag("is_bot", "true or false, both when omitted"),
    _flag("include_deleted", "true lists deleted users too"),
]
