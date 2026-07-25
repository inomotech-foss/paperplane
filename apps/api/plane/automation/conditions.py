# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Evaluation of automation condition trees.

A condition tree is JSON authored by the designer:

    {
      "type": "group",
      "logical_operator": "and",
      "children": [
        {"type": "condition", "property": "state_group", "operator": "in", "value": ["started"]},
        {"type": "condition", "property": "target_date", "operator": "overdue_by_days", "value": 3}
      ]
    }

``None`` (or an empty group) means "no restriction" and evaluates to ``True``.
Any malformed node evaluates to ``False`` so a broken rule fails closed instead
of firing against every work item.
"""

# Python imports
import datetime

# Django imports
from django.utils import timezone

# Module imports
from plane.automation.registry import Operator

LOGICAL_AND = "and"
LOGICAL_OR = "or"

NODE_GROUP = "group"
NODE_CONDITION = "condition"


class ConditionError(ValueError):
    """Raised when a condition tree cannot be interpreted."""


def _as_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return [item for item in value]
    return [value]


def _normalize(value):
    """Compare ids and enums as strings so UUID/str mismatches don't matter."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, (datetime.datetime, datetime.date)):
        return value
    return str(value)


def _normalize_all(values) -> list:
    return [_normalize(value) for value in _as_list(values)]


def _to_date(value):
    """Coerce dates, datetimes and ISO strings to a ``date``."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime.datetime):
        return timezone.localtime(value).date() if timezone.is_aware(value) else value.date()
    if isinstance(value, datetime.date):
        return value
    try:
        text = str(value)
        # Tolerate both `2026-07-24` and full ISO timestamps.
        return datetime.date.fromisoformat(text[:10])
    except ValueError:
        return None


def _to_number(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _is_empty(actual) -> bool:
    if actual is None:
        return True
    if isinstance(actual, (list, tuple, set, dict, str)):
        return len(actual) == 0
    return False


def _evaluate_comparison(operator: str, actual, expected) -> bool:
    left = _to_number(actual)
    right = _to_number(expected)
    if left is None or right is None:
        # Fall back to date comparison for date properties.
        left_date = _to_date(actual)
        right_date = _to_date(expected)
        if left_date is None or right_date is None:
            return False
        left, right = left_date, right_date

    if operator == Operator.GT:
        return left > right
    if operator == Operator.GTE:
        return left >= right
    if operator == Operator.LT:
        return left < right
    return left <= right


def _evaluate_relative_date(operator: str, actual, expected, today: datetime.date) -> bool:
    actual_date = _to_date(actual)
    days = _to_number(expected)
    if actual_date is None or days is None:
        return False
    days = int(days)

    if operator == Operator.DUE_IN_DAYS:
        # Due within the next `days` days and not already past due.
        delta = (actual_date - today).days
        return 0 <= delta <= days
    if operator == Operator.OVERDUE_BY_DAYS:
        # Past due by at least `days` days.
        return (today - actual_date).days >= days
    # OLDER_THAN_DAYS
    return (today - actual_date).days >= days


def _evaluate_change(operator: str, property_key: str, expected, changes: dict) -> bool:
    change = changes.get(property_key)
    if change is None:
        return False
    if operator == Operator.CHANGED:
        return True

    expected_values = _normalize_all(expected)
    if operator == Operator.CHANGED_TO:
        new_values = _normalize_all(change.get("new"))
        return any(value in expected_values for value in new_values)
    # CHANGED_FROM
    old_values = _normalize_all(change.get("old"))
    return any(value in expected_values for value in old_values)


def evaluate_condition_node(node: dict, context) -> bool:
    """Evaluate a single leaf node against the context."""
    property_key = node.get("property")
    operator = node.get("operator")
    if not property_key or not operator:
        raise ConditionError("A condition needs both a property and an operator.")

    if operator in (Operator.CHANGED, Operator.CHANGED_TO, Operator.CHANGED_FROM):
        return _evaluate_change(operator, property_key, node.get("value"), context.changes)

    actual = context.get(property_key)
    expected = node.get("value")

    if operator == Operator.IS_EMPTY:
        return _is_empty(actual)
    if operator == Operator.IS_NOT_EMPTY:
        return not _is_empty(actual)

    if operator in (Operator.DUE_IN_DAYS, Operator.OVERDUE_BY_DAYS, Operator.OLDER_THAN_DAYS):
        return _evaluate_relative_date(operator, actual, expected, context.today)

    if operator in (Operator.GT, Operator.GTE, Operator.LT, Operator.LTE):
        return _evaluate_comparison(operator, actual, expected)

    if operator in (Operator.CONTAINS, Operator.NOT_CONTAINS):
        # `contains` means set intersection for collections and substring for
        # text, which is what the designer's property kinds imply.
        if isinstance(actual, (list, tuple, set)):
            actual_values = _normalize_all(actual)
            expected_values = _normalize_all(expected)
            hit = any(value in actual_values for value in expected_values)
        else:
            haystack = "" if actual is None else str(actual).casefold()
            needles = [str(value).casefold() for value in _as_list(expected)]
            hit = any(needle in haystack for needle in needles if needle)
        return hit if operator == Operator.CONTAINS else not hit

    if operator in (Operator.IN, Operator.NOT_IN):
        expected_values = _normalize_all(expected)
        if isinstance(actual, (list, tuple, set)):
            actual_values = _normalize_all(actual)
            hit = any(value in expected_values for value in actual_values)
        else:
            hit = _normalize(actual) in expected_values
        return hit if operator == Operator.IN else not hit

    if operator in (Operator.EQ, Operator.NEQ):
        if isinstance(actual, bool) or isinstance(expected, bool):
            hit = bool(actual) == bool(expected)
        else:
            hit = _normalize(actual) == _normalize(expected)
        return hit if operator == Operator.EQ else not hit

    raise ConditionError(f"Unsupported operator '{operator}'.")


def evaluate(condition, context) -> bool:
    """
    Evaluate a condition tree. Returns ``True`` when the tree is empty, and
    ``False`` when it is malformed.
    """
    if condition is None:
        return True
    if not isinstance(condition, dict):
        return False

    node_type = condition.get("type", NODE_GROUP)

    if node_type == NODE_CONDITION:
        try:
            return evaluate_condition_node(condition, context)
        except ConditionError:
            return False

    if node_type != NODE_GROUP:
        return False

    children = condition.get("children") or []
    if not children:
        return True

    logical_operator = str(condition.get("logical_operator", LOGICAL_AND)).lower()
    results = (evaluate(child, context) for child in children)
    if logical_operator == LOGICAL_OR:
        return any(results)
    return all(results)


def collect_properties(condition) -> set[str]:
    """Every property key referenced by a tree, used for query pre-filtering."""
    if not isinstance(condition, dict):
        return set()
    if condition.get("type", NODE_GROUP) == NODE_CONDITION:
        key = condition.get("property")
        return {key} if key else set()
    keys: set[str] = set()
    for child in condition.get("children") or []:
        keys |= collect_properties(child)
    return keys


def uses_change_operators(condition) -> bool:
    """
    True when the tree depends on what changed, which means it can only be
    satisfied by an event trigger.
    """
    if not isinstance(condition, dict):
        return False
    if condition.get("type", NODE_GROUP) == NODE_CONDITION:
        return condition.get("operator") in (Operator.CHANGED, Operator.CHANGED_TO, Operator.CHANGED_FROM)
    return any(uses_change_operators(child) for child in condition.get("children") or [])
