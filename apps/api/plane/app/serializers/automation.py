# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from plane.automation import validators
from plane.automation.registry import TriggerType
from plane.automation.scheduling import describe as describe_schedule
from plane.db.models import Automation, AutomationAction, AutomationRun, AutomationScope
from .base import BaseSerializer


class AutomationActionSerializer(BaseSerializer):
    class Meta:
        model = AutomationAction
        fields = [
            "id",
            "automation",
            "action_type",
            "config",
            "sort_order",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["id", "automation", "created_at", "updated_at", "created_by"]

    def validate(self, attrs):
        action_type = attrs.get("action_type", getattr(self.instance, "action_type", None))
        # A PATCH that only sends `config` still has to validate against the
        # action type already stored.
        config = attrs.get("config", getattr(self.instance, "config", {}))
        # `action_error` returns a literal message rather than raising, so nothing
        # exception-derived is ever echoed back to the caller.
        message = validators.action_error(action_type, config)
        if message:
            raise serializers.ValidationError({"config": message})
        return attrs


class AutomationRunSerializer(BaseSerializer):
    class Meta:
        model = AutomationRun
        fields = [
            "id",
            "automation",
            "project",
            "status",
            "trigger_source",
            "trigger_type",
            "entity_type",
            "entity_identifier",
            "initiator",
            "started_at",
            "finished_at",
            "duration_ms",
            "processed_count",
            "steps",
            "error",
        ]
        read_only_fields = fields


class AutomationSerializer(BaseSerializer):
    actions = AutomationActionSerializer(many=True, read_only=True)
    project_ids = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True)
    projects = serializers.SerializerMethodField()
    average_duration_ms = serializers.IntegerField(read_only=True)
    schedule_summary = serializers.SerializerMethodField()

    class Meta:
        model = Automation
        fields = [
            "id",
            "workspace",
            "project",
            "scope",
            "applies_to_all_projects",
            "projects",
            "project_ids",
            "name",
            "description",
            "trigger_type",
            "trigger_config",
            "condition",
            "is_enabled",
            "next_run_at",
            "last_run_at",
            "last_run_status",
            "total_run_count",
            "failed_run_count",
            "average_duration_ms",
            "schedule_summary",
            "owned_by",
            "actions",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = [
            "id",
            "workspace",
            "project",
            "scope",
            "next_run_at",
            "last_run_at",
            "last_run_status",
            "total_run_count",
            "failed_run_count",
            "owned_by",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]

    def get_projects(self, obj) -> list[str]:
        if obj.scope == AutomationScope.PROJECT:
            return [str(obj.project_id)] if obj.project_id else []
        return [str(link.project_id) for link in obj.automation_projects.all()]

    def get_schedule_summary(self, obj) -> str | None:
        if obj.trigger_type != TriggerType.SCHEDULE:
            return None
        return describe_schedule(obj.trigger_config)

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Give the automation a name.")
        return value

    def validate(self, attrs):
        instance = self.instance

        trigger_type = attrs.get("trigger_type", getattr(instance, "trigger_type", ""))
        trigger_config = attrs.get("trigger_config", getattr(instance, "trigger_config", {}))
        condition = attrs.get("condition", getattr(instance, "condition", None))

        # The trigger is fixed once the automation exists: swapping it would
        # invalidate every action and condition built on top of it.
        if instance is not None and "trigger_type" in attrs:
            if instance.trigger_type and attrs["trigger_type"] != instance.trigger_type:
                raise serializers.ValidationError(
                    {"trigger_type": "You can't change the trigger type once the automation is created."}
                )

        trigger_message = validators.trigger_error(trigger_type, trigger_config)
        if trigger_message:
            raise serializers.ValidationError({"trigger_config": trigger_message})

        condition_message = validators.condition_error(condition)
        if condition_message:
            raise serializers.ValidationError({"condition": condition_message})

        scope = getattr(instance, "scope", None) or self.context.get("scope")
        targets_projects = True
        if scope == AutomationScope.WORKSPACE:
            applies_to_all = attrs.get("applies_to_all_projects", getattr(instance, "applies_to_all_projects", False))
            project_ids = attrs.get("project_ids")
            existing = instance.automation_projects.exists() if instance is not None else False
            targets_projects = bool(applies_to_all or project_ids or existing)

            # Creating a workspace automation has to say where it runs. Narrowing an
            # existing one from "all projects" to a selection is a two-step edit in
            # the designer, so an empty selection mid-edit is allowed and caught by
            # the enable check below - same as a draft with no trigger yet.
            if instance is None and not targets_projects:
                raise serializers.ValidationError({"project_ids": "Select the projects this automation should run on."})

        is_enabled = attrs.get("is_enabled", getattr(instance, "is_enabled", False))
        if is_enabled:
            has_actions = instance is not None and instance.actions.exists()
            if not trigger_type or not has_actions:
                raise serializers.ValidationError(
                    {"is_enabled": "An automation needs a trigger and at least one action before it can be enabled."}
                )
            if not targets_projects:
                raise serializers.ValidationError({"project_ids": "Select the projects this automation should run on."})

        return attrs
