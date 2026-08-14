# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Field and lookup allowlists for structured work item filters.

The field vocabulary is `WorkItemCountGroupBy` from plane-sdk 0.2.20
(`plane/models/query_params.py`), which fixes the set of work item fields a
client may group and filter by. Every name a client sends is matched as a
whole against `FILTER_FIELDS`; nothing else reaches the ORM. This is the same
defence `sanitize_order_by` applies to ordering (GHSA-p885-6jpg-cr2p).
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime

UUID_TYPE = "uuid"
TEXT_TYPE = "text"
DATE_TYPE = "date"

EXACT = "exact"
IN = "in"
GT = "gt"
GTE = "gte"
LT = "lt"
LTE = "lte"
RANGE = "range"
ISNULL = "isnull"
ICONTAINS = "icontains"

# Suffixes a client may append to a field name. `exact` is the implicit lookup
# of a bare field name and has no suffix.
LOOKUP_SUFFIXES = (IN, GTE, LTE, GT, LT, RANGE, ISNULL, ICONTAINS)

UUID_LOOKUPS = frozenset({EXACT, IN, ISNULL})
TEXT_LOOKUPS = frozenset({EXACT, IN, ISNULL, ICONTAINS})
DATE_LOOKUPS = frozenset({EXACT, IN, GT, GTE, LT, LTE, RANGE, ISNULL})

# Mirrors Issue.PRIORITY_CHOICES and State.group choices.
PRIORITY_CHOICES = frozenset({"urgent", "high", "medium", "low", "none"})
STATE_GROUP_CHOICES = frozenset({"backlog", "unstarted", "started", "completed", "cancelled"})

CUSTOM_PROPERTY_PREFIX = "property__"


@dataclass(frozen=True)
class FilterField:
    """One allowlisted filter field and the ORM path it compiles to."""

    path: str
    value_type: str
    lookups: frozenset
    choices: frozenset = None
    # Extra kwargs that exclude soft-deleted rows of a join table, matching the
    # guards in plane.utils.issue_filters.
    join_guard: tuple = ()


FILTER_FIELDS = {
    "state_id": FilterField(path="state_id", value_type=UUID_TYPE, lookups=UUID_LOOKUPS),
    "state__group": FilterField(
        path="state__group",
        value_type=TEXT_TYPE,
        lookups=TEXT_LOOKUPS,
        choices=STATE_GROUP_CHOICES,
    ),
    "priority": FilterField(
        path="priority",
        value_type=TEXT_TYPE,
        lookups=TEXT_LOOKUPS,
        choices=PRIORITY_CHOICES,
    ),
    "project_id": FilterField(path="project_id", value_type=UUID_TYPE, lookups=UUID_LOOKUPS),
    "type_id": FilterField(path="type_id", value_type=UUID_TYPE, lookups=UUID_LOOKUPS),
    "labels__id": FilterField(
        path="labels__id",
        value_type=UUID_TYPE,
        lookups=UUID_LOOKUPS,
        join_guard=(("label_issue__deleted_at__isnull", True),),
    ),
    "assignees__id": FilterField(
        path="assignees__id",
        value_type=UUID_TYPE,
        lookups=UUID_LOOKUPS,
        join_guard=(("issue_assignee__deleted_at__isnull", True),),
    ),
    "issue_module__module_id": FilterField(
        path="issue_module__module_id",
        value_type=UUID_TYPE,
        lookups=UUID_LOOKUPS,
        join_guard=(("issue_module__deleted_at__isnull", True),),
    ),
    "cycle_id": FilterField(
        path="issue_cycle__cycle_id",
        value_type=UUID_TYPE,
        lookups=UUID_LOOKUPS,
        join_guard=(("issue_cycle__deleted_at__isnull", True),),
    ),
    "created_by": FilterField(path="created_by_id", value_type=UUID_TYPE, lookups=UUID_LOOKUPS),
    # The landing field of the `childOf("PROJ-12")` placeholder, once the
    # identifier has been resolved to a work item id.
    "parent_id": FilterField(path="parent_id", value_type=UUID_TYPE, lookups=UUID_LOOKUPS),
    "target_date": FilterField(path="target_date", value_type=DATE_TYPE, lookups=DATE_LOOKUPS),
    "start_date": FilterField(path="start_date", value_type=DATE_TYPE, lookups=DATE_LOOKUPS),
}

# Part of the SDK vocabulary but backed by no model in this edition, so they get
# an explicit answer instead of an "unknown field" one.
UNSUPPORTED_FIELDS = {
    "milestone_id": "milestones are not available on this Plane edition",
    "release_work_items__release_id": "releases are not available on this Plane edition",
}


# The SDK documents the group-by name `state__group` but spells the same field
# `state_group` in its `filters` example, so both are accepted.
FIELD_ALIASES = {"state_group": "state__group"}


def _resolve_field(name):
    name = FIELD_ALIASES.get(name, name)
    return name if name in FILTER_FIELDS else None


def split_field_lookup(key):
    """Split a leaf key into `(field_name, lookup)`.

    The field name is matched as a whole against the allowlist, never by
    splitting on `__` and checking a prefix, so a key that traverses an
    unlisted relation (`assignees__email`) cannot pass as a listed one.
    Returns `(None, None)` when the key names no allowlisted field.
    """
    name = _resolve_field(key)
    if name is not None:
        return name, EXACT
    for lookup in LOOKUP_SUFFIXES:
        suffix = f"__{lookup}"
        if key.endswith(suffix):
            name = _resolve_field(key[: -len(suffix)])
            if name is not None:
                return name, lookup
    return None, None


def split_custom_property_lookup(key):
    """Split a `property__<uuid>[__gt|__lt]` leaf key into `(property_id, lookup)`.

    Returns `(None, None)` when the key is not a custom property key at all, and
    raises `ValueError` when it is one but the id is not a UUID.
    """
    if not key.startswith(CUSTOM_PROPERTY_PREFIX):
        return None, None
    rest = key[len(CUSTOM_PROPERTY_PREFIX) :]
    lookup = EXACT
    for candidate in (GT, LT):
        suffix = f"__{candidate}"
        if rest.endswith(suffix):
            rest = rest[: -len(suffix)]
            lookup = candidate
            break
    return str(uuid.UUID(rest)), lookup


def coerce_value(field, value):
    """Coerce a single JSON scalar to the type the field stores.

    Raises `ValueError` with a client-safe message on anything unusable.
    """
    if field.value_type == UUID_TYPE:
        if isinstance(value, uuid.UUID):
            return value
        if not isinstance(value, str):
            raise ValueError("expected a UUID string")
        return uuid.UUID(value)
    if field.value_type == DATE_TYPE:
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if not isinstance(value, str):
            raise ValueError("expected an ISO 8601 date string")
        return date.fromisoformat(value)
    if isinstance(value, bool) or not isinstance(value, str):
        raise ValueError("expected a string")
    if field.choices is not None and value not in field.choices:
        raise ValueError(f"expected one of {', '.join(sorted(field.choices))}")
    return value
