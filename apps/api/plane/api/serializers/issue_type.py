# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import IssueType


class IssueTypeSerializer(BaseSerializer):
    """
    Serializer for work item types.

    `is_epic` is always read-only through the API: it can never be set on
    create (the view forces it to `False`) and can never be changed on
    update (rejected with a 400).
    """

    def validate(self, data):
        # `is_epic` is declared read_only so DRF silently drops it from the
        # validated data; check the raw payload instead so attempts to
        # change it are rejected rather than quietly ignored.
        if (
            self.instance is not None
            and "is_epic" in self.initial_data
            and bool(self.initial_data["is_epic"]) != self.instance.is_epic
        ):
            raise serializers.ValidationError("is_epic cannot be changed")
        return data

    class Meta:
        model = IssueType
        fields = "__all__"
        read_only_fields = [
            "id",
            "workspace",
            "is_epic",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
