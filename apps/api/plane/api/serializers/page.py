# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import Page
from plane.utils.content_validator import validate_html_content


class PageSerializer(BaseSerializer):
    class Meta:
        model = Page
        fields = [
            "id",
            "name",
            "description_html",
            "parent",
            "access",
            "color",
            "is_locked",
            "archived_at",
            "view_props",
            "logo_props",
            "external_id",
            "external_source",
            "workspace",
            "owned_by",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = [
            "workspace",
            "owned_by",
            "archived_at",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]

    def validate(self, data):
        # Validate description content for security
        if "description_html" in data and data["description_html"]:
            is_valid, error_msg, sanitized_html = validate_html_content(data["description_html"])
            if not is_valid:
                raise serializers.ValidationError({"error": "html content is not valid"})
            # Update the data with sanitized HTML if available
            if sanitized_html is not None:
                data["description_html"] = sanitized_html

        return data
