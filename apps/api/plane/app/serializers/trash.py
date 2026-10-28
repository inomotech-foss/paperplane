# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import datetime, timedelta

from django.conf import settings
from rest_framework import serializers

from plane.db.models import Issue

from .base import BaseSerializer


class TrashedIssueSerializer(BaseSerializer):
    project_identifier = serializers.CharField(source="project.identifier", read_only=True)
    deleted_by = serializers.UUIDField(source="updated_by_id", read_only=True, allow_null=True)
    purge_at = serializers.SerializerMethodField()

    class Meta:
        model = Issue
        fields = [
            "id",
            "name",
            "sequence_id",
            "project_identifier",
            "type_id",
            "deleted_at",
            "deleted_by",
            "purge_at",
        ]
        read_only_fields = fields

    def get_purge_at(self, issue) -> datetime:
        return issue.deleted_at + timedelta(days=settings.HARD_DELETE_AFTER_DAYS)
