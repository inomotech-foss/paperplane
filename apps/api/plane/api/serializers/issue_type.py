# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import IssueType


class IssueTypeSerializer(BaseSerializer):
    """Serializer for work item types."""

    project_ids = serializers.SerializerMethodField()

    def get_project_ids(self, obj):
        """Projects this type is enabled for.

        Reads `project_issue_types` off the instance, so callers listing many
        types must prefetch it.
        """
        return [str(link.project_id) for link in obj.project_issue_types.all()]

    class Meta:
        model = IssueType
        fields = "__all__"
        read_only_fields = [
            "id",
            "workspace",
            "project_ids",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
