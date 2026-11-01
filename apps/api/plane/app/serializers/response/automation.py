# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.automation.registry import NOTIFICATION_RECIPIENTS, ActionType, Operator, PropertyKind, TriggerType

TRIGGER_TYPES = tuple(TriggerType)
ACTION_TYPES = tuple(ActionType)
OPERATORS = tuple(Operator)
PROPERTY_KINDS = tuple(PropertyKind)
VALUE_SOURCES = (
    "states",
    "state_groups",
    "priorities",
    "members",
    "labels",
    "modules",
    "cycles",
    "projects",
    "work_item_types",
    "estimate_points",
)
CHANGE_TYPES = ("set", "add", "remove", "clear", "shift_days")
TRIGGER_GROUPS = ("plane_events", "time_based")
TRIGGER_ENTITIES = ("work_item",)


def strings():
    return serializers.ListField(child=serializers.CharField())


def choices(values):
    return serializers.ListField(child=serializers.ChoiceField(choices=values))


class TriggerSerializer(serializers.Serializer):
    key = serializers.ChoiceField(choices=TRIGGER_TYPES)
    i18n_label = serializers.CharField()
    group = serializers.ChoiceField(choices=TRIGGER_GROUPS)
    entity = serializers.ChoiceField(choices=TRIGGER_ENTITIES, allow_null=True)
    changed_field = serializers.CharField(allow_null=True)
    allowed_actions = choices(ACTION_TYPES)


class ConditionPropertySerializer(serializers.Serializer):
    key = serializers.CharField()
    i18n_label = serializers.CharField()
    kind = serializers.ChoiceField(choices=PROPERTY_KINDS)
    source = serializers.ChoiceField(choices=VALUE_SOURCES, allow_null=True)
    operators = choices(OPERATORS)


class MutablePropertySerializer(serializers.Serializer):
    key = serializers.CharField()
    i18n_label = serializers.CharField()
    kind = serializers.ChoiceField(choices=PROPERTY_KINDS)
    source = serializers.ChoiceField(choices=VALUE_SOURCES, allow_null=True)
    change_types = choices(CHANGE_TYPES)


class ActionTypeSerializer(serializers.Serializer):
    key = serializers.ChoiceField(choices=ACTION_TYPES)
    i18n_label = serializers.CharField()
    requires_entity = serializers.BooleanField()


class AutomationCatalogSerializer(serializers.Serializer):
    triggers = TriggerSerializer(many=True)
    condition_properties = ConditionPropertySerializer(many=True)
    mutable_properties = MutablePropertySerializer(many=True)
    actions = ActionTypeSerializer(many=True)
    notification_recipients = choices(NOTIFICATION_RECIPIENTS)
    template_variables = strings()


def errors():
    return serializers.ListField(child=serializers.CharField(), required=False)


class ActionConfigErrorSerializer(serializers.Serializer):
    config = strings()


class AutomationActionValidationErrorSerializer(serializers.Serializer):
    """Field errors for a rejected action write. An incomplete config is only rejected while enabled."""

    action_type = errors()
    config = errors()
    sort_order = errors()


class AutomationValidationErrorSerializer(serializers.Serializer):
    """
    Field errors for a rejected automation write. Only the failing keys are
    present. Enabling reports every incomplete part at once.
    """

    name = errors()
    trigger_type = errors()
    trigger_config = errors()
    condition = errors()
    project_ids = errors()
    is_enabled = errors()
    actions = serializers.DictField(
        child=ActionConfigErrorSerializer(), required=False, help_text="Incomplete actions, keyed by action id"
    )
