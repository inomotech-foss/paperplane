# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import re

from rest_framework import serializers

from plane.db.models import ProjectLink

from .base import BaseSerializer

MAX_URL_LENGTH = 2048

# Mirrored in apps/web/store/project/project-link-url.ts; keep both in sync.
_ABSOLUTE_URL = re.compile(
    r"^https?://(?:[^/?#@]*@)?(?:\[[0-9a-f:.]+\]|[^/?#@:\[\]]+)(?::[0-9]{1,5})?(?:[/?#].*)?$", re.IGNORECASE
)
# Whitespace, control characters and backslashes are reinterpreted by browsers.
_FORBIDDEN = re.compile(r"[\s\x00-\x1f\x7f\\]")

INVALID_URL_MESSAGE = "Only http(s) URLs with a host and paths starting with a single / are allowed."


def validate_project_link_url(value: str) -> str:
    """Allow http(s) URLs with a host and same-origin paths only."""
    value = value.strip()
    if not value or len(value) > MAX_URL_LENGTH or _FORBIDDEN.search(value):
        raise serializers.ValidationError(INVALID_URL_MESSAGE)
    if value.startswith("/"):
        # "//host" is protocol-relative and leaves the origin.
        if value.startswith("//"):
            raise serializers.ValidationError(INVALID_URL_MESSAGE)
        return value
    if not _ABSOLUTE_URL.match(value):
        raise serializers.ValidationError(INVALID_URL_MESSAGE)
    return value


class ProjectLinkSerializer(BaseSerializer):
    class Meta:
        model = ProjectLink
        fields = ["id", "project", "title", "url", "sort_order", "created_at", "updated_at"]
        read_only_fields = ["id", "project", "sort_order", "created_at", "updated_at"]

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Title is required.")
        return value

    def validate_url(self, value):
        return validate_project_link_url(value)
