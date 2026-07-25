# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Database pre-filtering for scheduled sweeps.

A scheduled automation with conditions has to consider every work item in its
target projects. Evaluating each one in Python is correct but wasteful, so this
module translates the cheap, highly selective parts of a condition tree into a
``Q`` object.

Correctness invariant: the generated ``Q`` must always match a **superset** of
what ``conditions.evaluate`` accepts. Anything this module cannot express with
certainty is simply left out, and the Python evaluator still has the final say.
Only top level ``AND`` children are considered - inside an ``OR`` a narrowing
filter could wrongly exclude rows.
"""

# Python imports
import datetime
import uuid

# Django imports
from django.db.models import Q
from django.utils import timezone

# Module imports
from plane.automation.conditions import NODE_CONDITION, NODE_GROUP, LOGICAL_AND
from plane.automation.registry import Operator


def _valid_uuids(values) -> list[str]:
    if not isinstance(values, (list, tuple, set)):
        values = [values]
    result = []
    for value in values:
        try:
            result.append(str(uuid.UUID(str(value))))
        except (ValueError, TypeError, AttributeError):
            return []
    return result


def _as_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _as_list(value) -> list:
    if isinstance(value, (list, tuple, set)):
        return list(value)
    return [value]


def _node_to_q(node: dict, today: datetime.date, now: datetime.datetime):
    """Translate one leaf node, or return ``None`` when it isn't expressible."""
    property_key = node.get("property")
    operator = node.get("operator")
    value = node.get("value")

    if operator == Operator.IN:
        if property_key == "state_group":
            groups = [str(item) for item in _as_list(value)]
            return Q(state__group__in=groups) if groups else None
        if property_key == "priority":
            priorities = [str(item) for item in _as_list(value)]
            return Q(priority__in=priorities) if priorities else None
        if property_key in ("state_id", "type_id", "created_by_id"):
            ids = _valid_uuids(value)
            return Q(**{f"{property_key}__in": ids}) if ids else None
        return None

    if operator == Operator.IS_EMPTY and property_key in (
        "target_date",
        "start_date",
        "parent_id",
        "estimate_point_id",
    ):
        return Q(**{f"{property_key}__isnull": True})

    if operator == Operator.IS_NOT_EMPTY and property_key in (
        "target_date",
        "start_date",
        "parent_id",
        "estimate_point_id",
    ):
        return Q(**{f"{property_key}__isnull": False})

    if property_key in ("target_date", "start_date"):
        if operator == Operator.OVERDUE_BY_DAYS:
            days = _as_int(value)
            # Past due by at least `days` days.
            return Q(**{f"{property_key}__lte": today - datetime.timedelta(days=days)}) if days is not None else None
        if operator == Operator.DUE_IN_DAYS:
            days = _as_int(value)
            if days is None:
                return None
            return Q(
                **{
                    f"{property_key}__gte": today,
                    f"{property_key}__lte": today + datetime.timedelta(days=days),
                }
            )
        if operator in (Operator.LT, Operator.LTE, Operator.GT, Operator.GTE):
            try:
                bound = datetime.date.fromisoformat(str(value)[:10])
            except (ValueError, TypeError):
                return None
            lookup = {Operator.LT: "lt", Operator.LTE: "lte", Operator.GT: "gt", Operator.GTE: "gte"}[operator]
            return Q(**{f"{property_key}__{lookup}": bound})

    if property_key in ("created_at", "updated_at") and operator == Operator.OLDER_THAN_DAYS:
        days = _as_int(value)
        return Q(**{f"{property_key}__lte": now - datetime.timedelta(days=days)}) if days is not None else None

    if property_key == "is_archived" and operator == Operator.EQ:
        return Q(archived_at__isnull=not bool(value))

    return None


def prefilter(condition, today: datetime.date, now: datetime.datetime | None = None) -> Q:
    """
    Build a ``Q`` that narrows a scheduled sweep. Returns an empty ``Q`` when
    nothing can be safely translated.
    """
    now = now or timezone.now()
    if not isinstance(condition, dict):
        return Q()

    node_type = condition.get("type", NODE_GROUP)
    if node_type == NODE_CONDITION:
        return _node_to_q(condition, today, now) or Q()

    if node_type != NODE_GROUP:
        return Q()

    # Only AND groups narrow safely; an OR branch may need rows a narrowing
    # filter would drop.
    if str(condition.get("logical_operator", LOGICAL_AND)).lower() != LOGICAL_AND:
        return Q()

    combined = Q()
    for child in condition.get("children") or []:
        child_type = child.get("type", NODE_GROUP) if isinstance(child, dict) else None
        if child_type == NODE_CONDITION:
            child_q = _node_to_q(child, today, now)
            if child_q is not None:
                combined &= child_q
        elif child_type == NODE_GROUP:
            combined &= prefilter(child, today, now)
    return combined
