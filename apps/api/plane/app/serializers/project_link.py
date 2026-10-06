# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from rest_framework import serializers

from plane.db.models import ProjectLink

from .base import BaseSerializer

MAX_URL_LENGTH = 2048

_absolute_url_validator = URLValidator(schemes=["http", "https"])


def validate_project_link_url(value: str) -> str:
    """Allow http(s) URLs and same-origin paths only."""
    value = value.strip()
    if not value or len(value) > MAX_URL_LENGTH:
        raise serializers.ValidationError("Invalid URL.")
    # Browsers strip or reinterpret whitespace and control characters.
    if any(char.isspace() or ord(char) < 32 or ord(char) == 127 for char in value):
        raise serializers.ValidationError("Invalid URL.")
    if value.startswith("/"):
        # "//host" and "/\host" are protocol-relative and leave the origin.
        if value.startswith("//") or "\\" in value:
            raise serializers.ValidationError("Invalid URL.")
        return value
    try:
        _absolute_url_validator(value)
    except DjangoValidationError:
        raise serializers.ValidationError("Only http(s) URLs and paths starting with / are allowed.")
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
