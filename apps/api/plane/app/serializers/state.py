# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from .base import BaseSerializer
from rest_framework import serializers

from plane.db.models import State, StateGroup


class StateSerializer(BaseSerializer):
    order = serializers.FloatField(read_only=True)

    class Meta:
        model = State
        fields = [
            "id",
            "project_id",
            "workspace_id",
            "name",
            "color",
            "group",
            "default",
            "description",
            "sequence",
            "order",
        ]
        read_only_fields = ["workspace", "project"]

    def validate(self, attrs):
        if attrs.get("group") == StateGroup.TRIAGE.value:
            raise serializers.ValidationError("Cannot create triage state")
        return attrs


PROJECT_STATE_GROUP_CHOICES = [choice for choice in StateGroup.choices if choice[0] != StateGroup.TRIAGE]
TRIAGE_STATE_GROUP_CHOICES = [(StateGroup.TRIAGE.value, StateGroup.TRIAGE.label)]


class ProjectStateSerializer(StateSerializer):
    """Schema only: the project state endpoints never return the triage state."""

    group = serializers.ChoiceField(choices=PROJECT_STATE_GROUP_CHOICES)


class OrderedStateSerializer(ProjectStateSerializer):
    """Schema only: the list endpoints always set the in-group order."""

    order = serializers.FloatField()


class IntakeStateSerializer(StateSerializer):
    """Schema only: the intake state is the project's triage state."""

    group = serializers.ChoiceField(choices=TRIAGE_STATE_GROUP_CHOICES)


class StateLiteSerializer(BaseSerializer):
    class Meta:
        model = State
        fields = ["id", "name", "color", "group"]
        read_only_fields = fields
