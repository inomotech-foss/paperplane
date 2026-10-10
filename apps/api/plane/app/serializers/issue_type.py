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


class IssueTypeUsageSerializer(serializers.Serializer):
    """How many rows of a project use a work item type."""

    work_items = serializers.IntegerField()
    deleted_work_items = serializers.IntegerField()
    drafts = serializers.IntegerField()
    intakes = serializers.IntegerField()
    automation_actions = serializers.IntegerField()


class IssueTypeMigrationOptionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    work_items = serializers.IntegerField(help_text="Work items in scope with this option.")


class IssueTypeMigrationPropertySerializer(serializers.Serializer):
    """A property of the old type alone that work items in scope have values in."""

    id = serializers.UUIDField()
    project_id = serializers.UUIDField()
    name = serializers.CharField()
    property_type = serializers.CharField()
    is_multi = serializers.BooleanField()
    relation_type = serializers.CharField(allow_null=True)
    work_items = serializers.IntegerField(help_text="Work items in scope with a value.")
    options = IssueTypeMigrationOptionSerializer(many=True)


class IssueTypeMigrationPreviewSerializer(serializers.Serializer):
    """What a type migration reaches: the rows in scope and the property values that need a decision."""

    references = IssueTypeUsageSerializer()
    properties = IssueTypeMigrationPropertySerializer(many=True)


class IssueTypeMigrationScopeSerializer(serializers.Serializer):
    """Exactly one of the fields."""

    work_items = serializers.ListField(child=serializers.UUIDField(), required=False)
    project = serializers.UUIDField(required=False)
    workspace = serializers.BooleanField(required=False)


class IssueTypeMigrationSerializer(serializers.Serializer):
    scope = IssueTypeMigrationScopeSerializer()
    replacement_type_id = serializers.UUIDField(
        required=False, help_text="Required while anything in scope uses the type."
    )
    property_mapping = serializers.DictField(
        child=serializers.JSONField(),
        required=False,
        help_text="Per property of the old type with values: "
        '{"target": <property id>, "options": {<old option id>: <new option id or null>}} or {"drop": true}.',
    )
    remove_type = serializers.ChoiceField(
        choices=["unlink", "delete"],
        required=False,
        help_text='"unlink" with a project scope unlinks the type, "delete" with the workspace scope deletes it.',
    )
    dry_run = serializers.BooleanField(required=False, help_text="Only return what the migration would reach.")
