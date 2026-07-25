# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
The catalog of triggers, condition properties and actions an automation can be
built from.

This module is the single source of truth for the automation vocabulary: the
engine validates against it and the designer UI renders from it (served by the
``/automations/metadata/`` endpoint), so a new capability only has to be
described once.
"""

# Python imports
from enum import StrEnum


class TriggerType(StrEnum):
    # Work item lifecycle
    WORK_ITEM_CREATED = "work_item.created"
    WORK_ITEM_UPDATED = "work_item.updated"
    WORK_ITEM_DELETED = "work_item.deleted"
    # Property specific updates, narrower than WORK_ITEM_UPDATED
    WORK_ITEM_STATE_CHANGED = "work_item.state_changed"
    WORK_ITEM_PRIORITY_CHANGED = "work_item.priority_changed"
    WORK_ITEM_ASSIGNEES_CHANGED = "work_item.assignees_changed"
    WORK_ITEM_LABELS_CHANGED = "work_item.labels_changed"
    WORK_ITEM_TARGET_DATE_CHANGED = "work_item.target_date_changed"
    WORK_ITEM_PARENT_CHANGED = "work_item.parent_changed"
    # Related entities
    WORK_ITEM_COMMENT_CREATED = "work_item.comment_created"
    WORK_ITEM_ADDED_TO_CYCLE = "work_item.added_to_cycle"
    WORK_ITEM_ADDED_TO_MODULE = "work_item.added_to_module"
    # Time based
    SCHEDULE = "schedule"


class ActionType(StrEnum):
    CHANGE_PROPERTY = "change_property"
    ADD_COMMENT = "add_comment"
    SEND_NOTIFICATION = "send_notification"
    CREATE_WORK_ITEM = "create_work_item"
    ARCHIVE_WORK_ITEM = "archive_work_item"
    CALL_WEBHOOK = "call_webhook"


class Operator(StrEnum):
    EQ = "eq"
    NEQ = "neq"
    IN = "in"
    NOT_IN = "not_in"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    IS_EMPTY = "is_empty"
    IS_NOT_EMPTY = "is_not_empty"
    GT = "gt"
    GTE = "gte"
    LT = "lt"
    LTE = "lte"
    # Change-aware operators, only meaningful for event triggers.
    CHANGED = "changed"
    CHANGED_TO = "changed_to"
    CHANGED_FROM = "changed_from"
    # Relative date operators, the value is a whole number of days.
    DUE_IN_DAYS = "due_in_days"
    OVERDUE_BY_DAYS = "overdue_by_days"
    OLDER_THAN_DAYS = "older_than_days"


class PropertyKind(StrEnum):
    """How the designer should render a value input for a condition property."""

    TEXT = "text"
    OPTION = "option"
    MULTI_OPTION = "multi_option"
    DATE = "date"
    NUMBER = "number"
    BOOLEAN = "boolean"


#: Operator sets reused across property definitions.
_ID_OPERATORS = [Operator.IN, Operator.NOT_IN, Operator.CHANGED, Operator.CHANGED_TO, Operator.CHANGED_FROM]
_MULTI_ID_OPERATORS = [
    Operator.CONTAINS,
    Operator.NOT_CONTAINS,
    Operator.IS_EMPTY,
    Operator.IS_NOT_EMPTY,
    Operator.CHANGED,
]
_TEXT_OPERATORS = [
    Operator.EQ,
    Operator.NEQ,
    Operator.CONTAINS,
    Operator.NOT_CONTAINS,
    Operator.IS_EMPTY,
    Operator.IS_NOT_EMPTY,
]
_DATE_OPERATORS = [
    Operator.EQ,
    Operator.GT,
    Operator.GTE,
    Operator.LT,
    Operator.LTE,
    Operator.IS_EMPTY,
    Operator.IS_NOT_EMPTY,
    Operator.DUE_IN_DAYS,
    Operator.OVERDUE_BY_DAYS,
    Operator.CHANGED,
]


TRIGGERS = {
    TriggerType.WORK_ITEM_CREATED: {
        "i18n_label": "automations.triggers.work_item_created",
        "group": "plane_events",
        "entity": "work_item",
    },
    TriggerType.WORK_ITEM_UPDATED: {
        "i18n_label": "automations.triggers.work_item_updated",
        "group": "plane_events",
        "entity": "work_item",
    },
    TriggerType.WORK_ITEM_STATE_CHANGED: {
        "i18n_label": "automations.triggers.work_item_state_changed",
        "group": "plane_events",
        "entity": "work_item",
        "changed_field": "state",
    },
    TriggerType.WORK_ITEM_PRIORITY_CHANGED: {
        "i18n_label": "automations.triggers.work_item_priority_changed",
        "group": "plane_events",
        "entity": "work_item",
        "changed_field": "priority",
    },
    TriggerType.WORK_ITEM_ASSIGNEES_CHANGED: {
        "i18n_label": "automations.triggers.work_item_assignees_changed",
        "group": "plane_events",
        "entity": "work_item",
        "changed_field": "assignees",
    },
    TriggerType.WORK_ITEM_LABELS_CHANGED: {
        "i18n_label": "automations.triggers.work_item_labels_changed",
        "group": "plane_events",
        "entity": "work_item",
        "changed_field": "labels",
    },
    TriggerType.WORK_ITEM_TARGET_DATE_CHANGED: {
        "i18n_label": "automations.triggers.work_item_target_date_changed",
        "group": "plane_events",
        "entity": "work_item",
        "changed_field": "target_date",
    },
    TriggerType.WORK_ITEM_PARENT_CHANGED: {
        "i18n_label": "automations.triggers.work_item_parent_changed",
        "group": "plane_events",
        "entity": "work_item",
        "changed_field": "parent",
    },
    TriggerType.WORK_ITEM_COMMENT_CREATED: {
        "i18n_label": "automations.triggers.work_item_comment_created",
        "group": "plane_events",
        "entity": "work_item",
    },
    TriggerType.WORK_ITEM_ADDED_TO_CYCLE: {
        "i18n_label": "automations.triggers.work_item_added_to_cycle",
        "group": "plane_events",
        "entity": "work_item",
    },
    TriggerType.WORK_ITEM_ADDED_TO_MODULE: {
        "i18n_label": "automations.triggers.work_item_added_to_module",
        "group": "plane_events",
        "entity": "work_item",
    },
    TriggerType.WORK_ITEM_DELETED: {
        "i18n_label": "automations.triggers.work_item_deleted",
        "group": "plane_events",
        "entity": "work_item",
        # A deleted work item cannot be mutated, only announced.
        "allowed_actions": [ActionType.SEND_NOTIFICATION, ActionType.CALL_WEBHOOK, ActionType.CREATE_WORK_ITEM],
    },
    TriggerType.SCHEDULE: {
        "i18n_label": "automations.triggers.schedule",
        "group": "time_based",
        # A schedule has no inherent entity. When the automation has conditions
        # it sweeps matching work items, otherwise it runs once per tick.
        "entity": None,
    },
}


#: Properties an automation condition can be built on. ``source`` tells the
#: designer where to fetch selectable values from.
CONDITION_PROPERTIES = {
    "state_id": {
        "i18n_label": "automations.properties.state",
        "kind": PropertyKind.OPTION,
        "source": "states",
        "operators": _ID_OPERATORS,
    },
    "state_group": {
        "i18n_label": "automations.properties.state_group",
        "kind": PropertyKind.OPTION,
        "source": "state_groups",
        "operators": [Operator.IN, Operator.NOT_IN, Operator.CHANGED_TO, Operator.CHANGED_FROM],
    },
    "priority": {
        "i18n_label": "automations.properties.priority",
        "kind": PropertyKind.OPTION,
        "source": "priorities",
        "operators": _ID_OPERATORS,
    },
    "assignee_ids": {
        "i18n_label": "automations.properties.assignees",
        "kind": PropertyKind.MULTI_OPTION,
        "source": "members",
        "operators": _MULTI_ID_OPERATORS,
    },
    "label_ids": {
        "i18n_label": "automations.properties.labels",
        "kind": PropertyKind.MULTI_OPTION,
        "source": "labels",
        "operators": _MULTI_ID_OPERATORS,
    },
    "module_ids": {
        "i18n_label": "automations.properties.modules",
        "kind": PropertyKind.MULTI_OPTION,
        "source": "modules",
        "operators": _MULTI_ID_OPERATORS,
    },
    "cycle_id": {
        "i18n_label": "automations.properties.cycle",
        "kind": PropertyKind.OPTION,
        "source": "cycles",
        "operators": [Operator.IN, Operator.NOT_IN, Operator.IS_EMPTY, Operator.IS_NOT_EMPTY],
    },
    "type_id": {
        "i18n_label": "automations.properties.work_item_type",
        "kind": PropertyKind.OPTION,
        "source": "work_item_types",
        "operators": [Operator.IN, Operator.NOT_IN],
    },
    "created_by_id": {
        "i18n_label": "automations.properties.created_by",
        "kind": PropertyKind.OPTION,
        "source": "members",
        "operators": [Operator.IN, Operator.NOT_IN],
    },
    "actor_id": {
        "i18n_label": "automations.properties.triggered_by",
        "kind": PropertyKind.OPTION,
        "source": "members",
        "operators": [Operator.IN, Operator.NOT_IN],
    },
    "project_id": {
        "i18n_label": "automations.properties.project",
        "kind": PropertyKind.OPTION,
        "source": "projects",
        "operators": [Operator.IN, Operator.NOT_IN],
    },
    "name": {
        "i18n_label": "automations.properties.name",
        "kind": PropertyKind.TEXT,
        "source": None,
        "operators": _TEXT_OPERATORS,
    },
    "description": {
        "i18n_label": "automations.properties.description",
        "kind": PropertyKind.TEXT,
        "source": None,
        "operators": _TEXT_OPERATORS,
    },
    "target_date": {
        "i18n_label": "automations.properties.target_date",
        "kind": PropertyKind.DATE,
        "source": None,
        "operators": _DATE_OPERATORS,
    },
    "start_date": {
        "i18n_label": "automations.properties.start_date",
        "kind": PropertyKind.DATE,
        "source": None,
        "operators": _DATE_OPERATORS,
    },
    "created_at": {
        "i18n_label": "automations.properties.created_at",
        "kind": PropertyKind.DATE,
        "source": None,
        "operators": [Operator.OLDER_THAN_DAYS, Operator.GT, Operator.LT],
    },
    "updated_at": {
        "i18n_label": "automations.properties.updated_at",
        "kind": PropertyKind.DATE,
        "source": None,
        "operators": [Operator.OLDER_THAN_DAYS, Operator.GT, Operator.LT],
    },
    "estimate_point_id": {
        "i18n_label": "automations.properties.estimate",
        "kind": PropertyKind.OPTION,
        "source": "estimate_points",
        "operators": [Operator.IN, Operator.NOT_IN, Operator.IS_EMPTY, Operator.IS_NOT_EMPTY],
    },
    "parent_id": {
        "i18n_label": "automations.properties.parent",
        "kind": PropertyKind.OPTION,
        "source": None,
        "operators": [Operator.IS_EMPTY, Operator.IS_NOT_EMPTY, Operator.CHANGED],
    },
    "is_archived": {
        "i18n_label": "automations.properties.is_archived",
        "kind": PropertyKind.BOOLEAN,
        "source": None,
        "operators": [Operator.EQ],
    },
    "sub_work_item_count": {
        "i18n_label": "automations.properties.sub_work_item_count",
        "kind": PropertyKind.NUMBER,
        "source": None,
        "operators": [Operator.EQ, Operator.NEQ, Operator.GT, Operator.GTE, Operator.LT, Operator.LTE],
    },
}


#: Properties an action can write, keyed by the value the designer sends as
#: ``config.property``. ``change_types`` lists the supported mutations.
MUTABLE_PROPERTIES = {
    "state_id": {
        "i18n_label": "automations.properties.state",
        "kind": PropertyKind.OPTION,
        "source": "states",
        "change_types": ["set"],
    },
    "priority": {
        "i18n_label": "automations.properties.priority",
        "kind": PropertyKind.OPTION,
        "source": "priorities",
        "change_types": ["set"],
    },
    "assignee_ids": {
        "i18n_label": "automations.properties.assignees",
        "kind": PropertyKind.MULTI_OPTION,
        "source": "members",
        "change_types": ["set", "add", "remove", "clear"],
    },
    "label_ids": {
        "i18n_label": "automations.properties.labels",
        "kind": PropertyKind.MULTI_OPTION,
        "source": "labels",
        "change_types": ["set", "add", "remove", "clear"],
    },
    "module_ids": {
        "i18n_label": "automations.properties.modules",
        "kind": PropertyKind.MULTI_OPTION,
        "source": "modules",
        "change_types": ["add", "remove"],
    },
    "cycle_id": {
        "i18n_label": "automations.properties.cycle",
        "kind": PropertyKind.OPTION,
        "source": "cycles",
        "change_types": ["set", "clear"],
    },
    "target_date": {
        "i18n_label": "automations.properties.target_date",
        "kind": PropertyKind.DATE,
        "source": None,
        "change_types": ["set", "clear", "shift_days"],
    },
    "start_date": {
        "i18n_label": "automations.properties.start_date",
        "kind": PropertyKind.DATE,
        "source": None,
        "change_types": ["set", "clear", "shift_days"],
    },
    "estimate_point_id": {
        "i18n_label": "automations.properties.estimate",
        "kind": PropertyKind.OPTION,
        "source": "estimate_points",
        "change_types": ["set", "clear"],
    },
    "parent_id": {
        "i18n_label": "automations.properties.parent",
        "kind": PropertyKind.OPTION,
        "source": None,
        "change_types": ["clear"],
    },
}


ACTIONS = {
    ActionType.CHANGE_PROPERTY: {
        "i18n_label": "automations.action.handler_name.change_property",
        "requires_entity": True,
    },
    ActionType.ADD_COMMENT: {
        "i18n_label": "automations.action.handler_name.add_comment",
        "requires_entity": True,
    },
    ActionType.SEND_NOTIFICATION: {
        "i18n_label": "automations.action.handler_name.send_notification",
        "requires_entity": False,
    },
    ActionType.CREATE_WORK_ITEM: {
        "i18n_label": "automations.action.handler_name.create_work_item",
        "requires_entity": False,
    },
    ActionType.ARCHIVE_WORK_ITEM: {
        "i18n_label": "automations.action.handler_name.archive_work_item",
        "requires_entity": True,
    },
    ActionType.CALL_WEBHOOK: {
        "i18n_label": "automations.action.handler_name.call_webhook",
        "requires_entity": False,
    },
}


#: Who a ``send_notification`` action can address.
NOTIFICATION_RECIPIENTS = [
    "assignees",
    "created_by",
    "actor",
    "subscribers",
    "project_admins",
    "specific_members",
]


#: Template variables available in comment bodies, notification text and
#: webhook payloads. Surfaced to the designer so it can offer autocomplete.
TEMPLATE_VARIABLES = [
    "work_item.name",
    "work_item.identifier",
    "work_item.url",
    "work_item.state",
    "work_item.priority",
    "work_item.assignees",
    "work_item.labels",
    "work_item.target_date",
    "work_item.start_date",
    "work_item.created_by",
    "project.name",
    "project.identifier",
    "workspace.name",
    "actor.display_name",
    "automation.name",
    "trigger.type",
    "now.date",
]


def trigger_definition(trigger_type: str) -> dict | None:
    return TRIGGERS.get(trigger_type)


def is_scheduled_trigger(trigger_type: str) -> bool:
    return trigger_type == TriggerType.SCHEDULE


def allowed_actions_for_trigger(trigger_type: str) -> list[str]:
    """Actions valid for a trigger, defaulting to the whole catalog."""
    definition = TRIGGERS.get(trigger_type)
    if definition and definition.get("allowed_actions"):
        return [str(action) for action in definition["allowed_actions"]]
    if is_scheduled_trigger(trigger_type):
        # A schedule with conditions sweeps work items so entity actions are
        # fine; without conditions the engine skips entity-bound actions.
        return [str(action) for action in ActionType]
    return [str(action) for action in ActionType]


def serialize_catalog() -> dict:
    """Build the JSON payload consumed by the designer UI."""
    return {
        "triggers": [
            {
                "key": str(key),
                "i18n_label": definition["i18n_label"],
                "group": definition["group"],
                "entity": definition.get("entity"),
                "changed_field": definition.get("changed_field"),
                "allowed_actions": allowed_actions_for_trigger(str(key)),
            }
            for key, definition in TRIGGERS.items()
        ],
        "condition_properties": [
            {
                "key": key,
                "i18n_label": definition["i18n_label"],
                "kind": str(definition["kind"]),
                "source": definition["source"],
                "operators": [str(operator) for operator in definition["operators"]],
            }
            for key, definition in CONDITION_PROPERTIES.items()
        ],
        "mutable_properties": [
            {
                "key": key,
                "i18n_label": definition["i18n_label"],
                "kind": str(definition["kind"]),
                "source": definition["source"],
                "change_types": definition["change_types"],
            }
            for key, definition in MUTABLE_PROPERTIES.items()
        ],
        "actions": [
            {
                "key": str(key),
                "i18n_label": definition["i18n_label"],
                "requires_entity": definition["requires_entity"],
            }
            for key, definition in ACTIONS.items()
        ],
        "notification_recipients": NOTIFICATION_RECIPIENTS,
        "template_variables": TEMPLATE_VARIABLES,
    }
