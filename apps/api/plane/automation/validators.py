# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Structural validation for the JSON blobs an automation stores.

The engine already fails closed on nonsense, but rejecting it at save time is
what turns "my automation silently does nothing" into an error message next to
the field that caused it.

Every check **returns** a message rather than raising. The serializer feeds these
straight into an API response, so the text has to be a literal authored here —
stringifying a caught exception would leak whatever a third party library chose
to say (and trips CodeQL's stack-trace-exposure rule).
"""

# Python imports
import uuid

# Module imports
from plane.automation.conditions import LOGICAL_AND, LOGICAL_OR, NODE_CONDITION, NODE_GROUP
from plane.automation.registry import (
    ACTIONS,
    CONDITION_PROPERTIES,
    MUTABLE_PROPERTIES,
    NOTIFICATION_RECIPIENTS,
    ActionType,
    TriggerType,
)
from plane.automation.scheduling import schedule_error

#: Depth cap so a pathological payload cannot blow the recursion limit.
MAX_CONDITION_DEPTH = 6


def trigger_error(trigger_type: str, trigger_config: dict) -> str | None:
    """Why this trigger can't be saved, or ``None`` when it's fine."""
    if not trigger_type:
        # An unfinished draft is allowed; enabling it is what requires a trigger.
        return None
    if trigger_type not in {str(value) for value in TriggerType}:
        return "That isn't a supported trigger."
    if trigger_type == TriggerType.SCHEDULE:
        return schedule_error(trigger_config or {})
    return None


def condition_error(condition, depth: int = 0) -> str | None:
    """Walk a condition tree, returning the first structural problem found."""
    if condition is None:
        return None
    if depth > MAX_CONDITION_DEPTH:
        return "The condition is nested too deeply."
    if not isinstance(condition, dict):
        return "A condition must be an object."

    node_type = condition.get("type", NODE_GROUP)

    if node_type == NODE_GROUP:
        logical_operator = str(condition.get("logical_operator", LOGICAL_AND)).lower()
        if logical_operator not in (LOGICAL_AND, LOGICAL_OR):
            return "That isn't a supported way to combine conditions."
        children = condition.get("children")
        if children is None:
            return None
        if not isinstance(children, list):
            return "A condition group's children must be a list."
        for child in children:
            error = condition_error(child, depth=depth + 1)
            if error is not None:
                return error
        return None

    if node_type != NODE_CONDITION:
        return "That isn't a valid condition node type."

    property_key = condition.get("property")
    definition = CONDITION_PROPERTIES.get(property_key)
    if definition is None:
        return "That isn't a property you can build a condition on."

    operator = condition.get("operator")
    allowed = {str(value) for value in definition["operators"]}
    if operator not in allowed:
        return "That comparison can't be used with the selected property."
    return None


def _is_uuid(value) -> bool:
    try:
        uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return False
    return True


def _change_property_error(config: dict) -> str | None:
    property_key = config.get("property")
    definition = MUTABLE_PROPERTIES.get(property_key)
    if definition is None:
        return "That isn't a property an automation can change."

    change_type = config.get("change_type", "set")
    if change_type not in definition["change_types"]:
        return "That change can't be applied to the selected property."

    if change_type == "clear":
        return None

    value = config.get("value")
    if value in (None, "", [], {}):
        return "Pick a value for the property you're changing."

    if definition["kind"] == "multi_option" and not isinstance(value, list):
        return "That property expects a list of values."
    return None


def _notification_error(config: dict) -> str | None:
    recipients = config.get("recipients") or []
    if not isinstance(recipients, list) or not recipients:
        return "Choose at least one recipient."
    if any(group not in NOTIFICATION_RECIPIENTS for group in recipients):
        return "One of the chosen recipient groups isn't recognised."
    if "specific_members" in recipients:
        members = config.get("member_ids") or []
        if not members:
            return "Pick the members to notify."
        if not all(_is_uuid(member_id) for member_id in members):
            return "One of the chosen members isn't a valid id."
    if not (config.get("title") or "").strip() and not (config.get("message") or "").strip():
        return "Give the notification a title or a message."
    return None


def _create_work_item_error(config: dict) -> str | None:
    if not (config.get("name") or "").strip():
        return "The new work item needs a name."
    if config.get("project_id") and not _is_uuid(config["project_id"]):
        return "The chosen project isn't a valid id."
    if config.get("state_id") and not _is_uuid(config["state_id"]):
        return "The chosen state isn't a valid id."
    if not all(_is_uuid(member_id) for member_id in config.get("assignee_ids") or []):
        return "One of the chosen assignees isn't a valid id."
    if not all(_is_uuid(label_id) for label_id in config.get("label_ids") or []):
        return "One of the chosen labels isn't a valid id."
    return None


def _webhook_error(config: dict) -> str | None:
    url = (config.get("url") or "").strip()
    if not url:
        return "The webhook needs a URL."
    if not url.lower().startswith(("http://", "https://")):
        return "The webhook URL must start with http:// or https://."
    if (config.get("method") or "POST").upper() not in ("POST", "PUT", "PATCH"):
        return "That isn't a supported webhook method."
    headers = config.get("headers")
    if headers is not None and not isinstance(headers, dict):
        return "Webhook headers must be an object."
    return None


def action_error(action_type: str, config) -> str | None:
    """Why this action can't be saved, or ``None`` when it's fine."""
    if action_type not in ACTIONS:
        return "That isn't a supported action."
    if config is None:
        config = {}
    if not isinstance(config, dict):
        return "Action configuration must be an object."

    if action_type == ActionType.CHANGE_PROPERTY:
        return _change_property_error(config)
    if action_type == ActionType.ADD_COMMENT:
        return None if (config.get("comment_html") or "").strip() else "The comment body is empty."
    if action_type == ActionType.SEND_NOTIFICATION:
        return _notification_error(config)
    if action_type == ActionType.CREATE_WORK_ITEM:
        return _create_work_item_error(config)
    if action_type == ActionType.CALL_WEBHOOK:
        return _webhook_error(config)
    # archive_work_item takes no configuration.
    return None
