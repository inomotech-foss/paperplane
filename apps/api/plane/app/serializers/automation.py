# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

# Module imports
from plane.automation import validators
from plane.automation.registry import ACTIONS, ActionType, TriggerType
from plane.automation.sanitize import sanitize_action_config
from plane.automation.scheduling import describe as describe_schedule
from plane.db.models import Automation, AutomationAction, AutomationRun, AutomationScope
from .base import BaseSerializer


# `validate` checks these against the registry, so the schema can promise the registry values.
@extend_schema_field({"type": "string", "enum": [*TriggerType, ""], "description": "Empty for a draft"})
class TriggerTypeField(serializers.CharField):
    pass


@extend_schema_field({"type": "string", "enum": list(ActionType)})
class ActionTypeField(serializers.CharField):
    pass


class AutomationActionSerializer(BaseSerializer):
    """
    While the automation is disabled an action may be incomplete. It is stored
    and `config_error` says what is missing. Writes to an enabled automation
    must be complete.

    Pass the parent automation as `context["automation"]`, locked for the
    write, so the check uses its current `is_enabled`.
    """

    action_type = ActionTypeField(max_length=127)
    config_error = serializers.SerializerMethodField(help_text="Why the action can't run yet. Null when it is complete")

    class Meta:
        model = AutomationAction
        fields = [
            "id",
            "automation",
            "action_type",
            "config",
            "config_error",
            "sort_order",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["id", "automation", "created_at", "updated_at", "created_by"]

    def get_config_error(self, obj) -> str | None:
        return validators.action_error(obj.action_type, obj.config)

    def validate_action_type(self, value):
        if value not in ACTIONS:
            raise serializers.ValidationError("That isn't a supported action.")
        return value

    def validate(self, attrs):
        # A legacy row may hold a config that is no longer valid. It is only
        # checked when the request changes it, so moving the action still works.
        if "config" not in attrs and "action_type" not in attrs:
            return attrs
        action_type = attrs.get("action_type", getattr(self.instance, "action_type", None))
        # A PATCH that only sends `config` still has to validate against the
        # action type already stored.
        config = attrs.get("config", getattr(self.instance, "config", {}))
        shape_message = validators.action_config_shape_error(action_type, config)
        if shape_message:
            raise serializers.ValidationError({"config": shape_message})
        config = sanitize_action_config(action_type, config)
        if config is None:
            raise serializers.ValidationError({"config": "The HTML template is not valid."})
        attrs["config"] = config

        automation = self.context.get("automation") or getattr(self.instance, "automation", None)
        if automation is None or automation.is_enabled:
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
    trigger_type = TriggerTypeField(max_length=127, required=False, allow_blank=True)
    actions = AutomationActionSerializer(many=True, read_only=True)
    project_ids = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True)
    projects = serializers.SerializerMethodField()
    average_duration_ms = serializers.IntegerField(read_only=True)
    schedule_summary = serializers.SerializerMethodField()
    trigger_config_error = serializers.SerializerMethodField(
        help_text="Why the trigger can't run yet. Null when it is complete or not chosen yet"
    )

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
            "trigger_config_error",
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

    def _trigger_error(self, obj) -> str | None:
        # Both fields below need it, and a schedule check walks the calendar.
        cache = self.context.setdefault("trigger_errors", {})
        key = (obj.pk, obj.trigger_type, repr(obj.trigger_config))
        if key not in cache:
            cache[key] = validators.trigger_error(obj.trigger_type, obj.trigger_config)
        return cache[key]

    def get_schedule_summary(self, obj) -> str | None:
        if obj.trigger_type != TriggerType.SCHEDULE or self._trigger_error(obj):
            return None
        return describe_schedule(obj.trigger_config)

    def get_trigger_config_error(self, obj) -> str | None:
        return self._trigger_error(obj)

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Give the automation a name.")
        return value

    def _enable_errors(self, trigger_type, trigger_config, condition, enabling) -> dict:
        """
        Everything that keeps the automation from running. The actions are only
        checked when it is being enabled, since writes to an enabled automation's
        actions are already checked one by one.
        """
        instance = self.instance
        actions = list(instance.actions.all()) if instance is not None else []
        errors = {}
        if not trigger_type or not actions:
            errors["is_enabled"] = ["An automation needs a trigger and at least one action before it can be enabled."]
        trigger_message = validators.trigger_error(trigger_type, trigger_config)
        if trigger_message:
            errors["trigger_config"] = [trigger_message]
        condition_message = validators.condition_error(condition)
        if condition_message:
            errors["condition"] = [condition_message]
        if enabling:
            incomplete = validators.incomplete_actions(actions)
            if incomplete:
                errors["actions"] = {action_id: {"config": [message]} for action_id, message in incomplete.items()}
        return errors

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

        # Only what the request sends is checked here, so a stored value that is
        # no longer valid never blocks an unrelated edit such as disabling.
        if "trigger_type" in attrs:
            hard_trigger_message = validators.trigger_type_error(trigger_type)
            if hard_trigger_message:
                raise serializers.ValidationError({"trigger_type": hard_trigger_message})
        if "trigger_type" in attrs or "trigger_config" in attrs:
            shape_message = validators.trigger_config_shape_error(trigger_type, trigger_config)
            if shape_message:
                raise serializers.ValidationError({"trigger_config": shape_message})
        if "condition" in attrs:
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
            enabling = not getattr(instance, "is_enabled", False)
            errors = self._enable_errors(trigger_type, trigger_config, condition, enabling=enabling)
            if not targets_projects:
                errors["project_ids"] = ["Select the projects this automation should run on."]
            if errors:
                raise serializers.ValidationError(errors)

        return attrs
