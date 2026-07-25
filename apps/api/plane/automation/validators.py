# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Structural validation for the JSON blobs an automation stores.

The engine already fails closed on nonsense, but rejecting it at save time is
what turns "my automation silently does nothing" into an error message next to
the field that caused it.
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
from plane.automation.scheduling import ScheduleError, validate as validate_schedule

#: Depth cap so a pathological payload cannot blow the recursion limit.
MAX_CONDITION_DEPTH = 6


class ValidationError(ValueError):
    """A human readable reason the payload cannot be saved."""


def validate_trigger(trigger_type: str, trigger_config: dict) -> None:
    if not trigger_type:
        # An unfinished draft is allowed; enabling it is what requires a trigger.
        return
    if trigger_type not in {str(value) for value in TriggerType}:
        raise ValidationError(f"'{trigger_type}' is not a supported trigger.")
    if trigger_type == TriggerType.SCHEDULE:
        try:
            validate_schedule(trigger_config or {})
        except ScheduleError as exception:
            raise ValidationError(str(exception)) from exception


def validate_condition(condition, depth: int = 0) -> None:
    """Walk a condition tree and reject unknown properties or operators."""
    if condition is None:
        return
    if depth > MAX_CONDITION_DEPTH:
        raise ValidationError("The condition is nested too deeply.")
    if not isinstance(condition, dict):
        raise ValidationError("A condition must be an object.")

    node_type = condition.get("type", NODE_GROUP)

    if node_type == NODE_GROUP:
        logical_operator = str(condition.get("logical_operator", LOGICAL_AND)).lower()
        if logical_operator not in (LOGICAL_AND, LOGICAL_OR):
            raise ValidationError(f"'{logical_operator}' is not a supported way to combine conditions.")
        children = condition.get("children")
        if children is None:
            return
        if not isinstance(children, list):
            raise ValidationError("A condition group's children must be a list.")
        for child in children:
            validate_condition(child, depth=depth + 1)
        return

    if node_type != NODE_CONDITION:
        raise ValidationError(f"'{node_type}' is not a valid condition node type.")

    property_key = condition.get("property")
    definition = CONDITION_PROPERTIES.get(property_key)
    if definition is None:
        raise ValidationError(f"'{property_key}' is not a property you can build a condition on.")

    operator = condition.get("operator")
    allowed = {str(value) for value in definition["operators"]}
    if operator not in allowed:
        raise ValidationError(f"'{operator}' cannot be used with {property_key}.")


def _require_uuid(value, label: str) -> str:
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, TypeError, AttributeError) as exception:
        raise ValidationError(f"{label} must be a valid id.") from exception


def _validate_change_property_config(config: dict) -> None:
    property_key = config.get("property")
    definition = MUTABLE_PROPERTIES.get(property_key)
    if definition is None:
        raise ValidationError(f"'{property_key}' is not a property an automation can change.")

    change_type = config.get("change_type", "set")
    if change_type not in definition["change_types"]:
        raise ValidationError(f"'{change_type}' cannot be applied to {property_key}.")

    if change_type == "clear":
        return

    value = config.get("value")
    if value in (None, "", [], {}):
        raise ValidationError("Pick a value for the property you're changing.")

    if definition["kind"] == "multi_option" and not isinstance(value, list):
        raise ValidationError(f"{property_key} expects a list of values.")


def _validate_notification_config(config: dict) -> None:
    recipients = config.get("recipients") or []
    if not isinstance(recipients, list) or not recipients:
        raise ValidationError("Choose at least one recipient.")
    unknown = [group for group in recipients if group not in NOTIFICATION_RECIPIENTS]
    if unknown:
        raise ValidationError(f"Unknown recipient group(s): {', '.join(str(item) for item in unknown)}.")
    if "specific_members" in recipients:
        members = config.get("member_ids") or []
        if not members:
            raise ValidationError("Pick the members to notify.")
        for member_id in members:
            _require_uuid(member_id, "Member")
    if not (config.get("title") or "").strip() and not (config.get("message") or "").strip():
        raise ValidationError("Give the notification a title or a message.")


def _validate_create_work_item_config(config: dict) -> None:
    if not (config.get("name") or "").strip():
        raise ValidationError("The new work item needs a name.")
    if config.get("project_id"):
        _require_uuid(config["project_id"], "Project")
    if config.get("state_id"):
        _require_uuid(config["state_id"], "State")
    for member_id in config.get("assignee_ids") or []:
        _require_uuid(member_id, "Assignee")
    for label_id in config.get("label_ids") or []:
        _require_uuid(label_id, "Label")


def _validate_webhook_config(config: dict) -> None:
    url = (config.get("url") or "").strip()
    if not url:
        raise ValidationError("The webhook needs a URL.")
    if not url.lower().startswith(("http://", "https://")):
        raise ValidationError("The webhook URL must start with http:// or https://.")
    method = (config.get("method") or "POST").upper()
    if method not in ("POST", "PUT", "PATCH"):
        raise ValidationError(f"'{method}' is not a supported webhook method.")
    headers = config.get("headers")
    if headers is not None and not isinstance(headers, dict):
        raise ValidationError("Webhook headers must be an object.")


def validate_action(action_type: str, config) -> None:
    if action_type not in ACTIONS:
        raise ValidationError(f"'{action_type}' is not a supported action.")
    if config is None:
        config = {}
    if not isinstance(config, dict):
        raise ValidationError("Action configuration must be an object.")

    if action_type == ActionType.CHANGE_PROPERTY:
        _validate_change_property_config(config)
    elif action_type == ActionType.ADD_COMMENT:
        if not (config.get("comment_html") or "").strip():
            raise ValidationError("The comment body is empty.")
    elif action_type == ActionType.SEND_NOTIFICATION:
        _validate_notification_config(config)
    elif action_type == ActionType.CREATE_WORK_ITEM:
        _validate_create_work_item_config(config)
    elif action_type == ActionType.CALL_WEBHOOK:
        _validate_webhook_config(config)
    # archive_work_item takes no configuration.
