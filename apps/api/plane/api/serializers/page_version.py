# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import PageVersion, User
from plane.utils.content_validator import validate_html_content


class PageVersionSerializer(BaseSerializer):
    """Version metadata without the body — what a history list needs."""

    class Meta:
        model = PageVersion
        fields = [
            "id",
            "page",
            "last_saved_at",
            "owned_by",
            "external_id",
            "external_source",
            "workspace",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = fields


class PageVersionDetailSerializer(BaseSerializer):
    """A single version including the body it captured."""

    class Meta:
        model = PageVersion
        fields = [
            "id",
            "page",
            "last_saved_at",
            "description_html",
            "description_json",
            "owned_by",
            "sub_pages_data",
            "external_id",
            "external_source",
            "workspace",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = fields


class PageVersionCreateSerializer(BaseSerializer):
    """
    Serializer for importing a page's history from another wiki.

    A version here is normally a side effect of an edit, so this accepts the
    facts a migration has to state outright: who saved it, when, and what the
    page looked like at that point. `last_saved_at` and `created_at` are
    writable because preserving the original timeline is the whole point.
    """

    description_html = serializers.CharField(allow_blank=False)
    created_at = serializers.DateTimeField(required=False)
    # the model insists on an owner; an import often cannot name one, so the
    # endpoint falls back to the page's owner rather than rejecting the version
    owned_by = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False, allow_null=True)

    class Meta:
        model = PageVersion
        fields = [
            "description_html",
            "description_json",
            "sub_pages_data",
            "owned_by",
            "last_saved_at",
            "created_at",
            "external_source",
            "external_id",
        ]

    def validate(self, attrs):
        # Imported HTML is rendered back to readers, so it goes through the same
        # sanitizer as a page body written through the API.
        is_valid, _error, sanitized = validate_html_content(attrs["description_html"])
        if not is_valid:
            raise serializers.ValidationError({"error": "html content is not valid"})
        if sanitized is not None:
            attrs["description_html"] = sanitized
        return attrs
