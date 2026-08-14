# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Compile the `filters` JSON expression into a Django `Q` object.

`filters` is the structured filter expression documented by plane-sdk 0.2.20:
nested `and` / `or` / `not` groups whose leaves are field comparisons using
Django-style lookups. The SDK's own example is

    {"and": [{"priority": "urgent"}, {"state_group__in": ["unstarted", "started"]}]}

Only names in `plane.utils.pql.fields.FILTER_FIELDS` and lookups in that
field's own lookup set ever reach the ORM. Anything else raises
`FilterCompileError`, which callers turn into a 400.

Custom property leaves (`property__<uuid>`) are collected separately rather
than compiled into the `Q`, because resolving them needs the property type from
the database. `plane.utils.issue_property.build_issue_property_filters` does
that work and returns AND-ed filter kwargs, so custom property leaves are only
accepted in conjunctive position.
"""

from dataclasses import dataclass, field as dataclass_field
from typing import Any

from django.db.models import Q

from plane.utils.pql.fields import (
    CUSTOM_PROPERTY_PREFIX,
    EXACT,
    FILTER_FIELDS,
    ICONTAINS,
    IN,
    ISNULL,
    RANGE,
    TEXT_TYPE,
    UNSUPPORTED_FIELDS,
    coerce_value,
    split_custom_property_lookup,
    split_field_lookup,
)

MAX_FILTER_DEPTH = 10

AND = "and"
OR = "or"
NOT = "not"
GROUP_OPERATORS = (AND, OR, NOT)


class FilterCompileError(Exception):
    """A structured, catchable error describing why a filter was rejected."""

    def __init__(self, message, field=None, lookup=None):
        super().__init__(message)
        self.message = message
        self.field = field
        self.lookup = lookup

    def as_dict(self):
        return {"error": self.message, "field": self.field, "lookup": self.lookup}


@dataclass(frozen=True)
class CustomPropertyFilter:
    """A `property__<uuid>` leaf, to be resolved against the database later."""

    property_id: str
    lookup: str
    value: Any


@dataclass
class CompiledFilters:
    q: Q = dataclass_field(default_factory=Q)
    custom_properties: list = dataclass_field(default_factory=list)


def compile_filters(expression):
    """Compile a `filters` expression into a `CompiledFilters`.

    Raises `FilterCompileError` on anything malformed or not allowlisted.
    """
    if not isinstance(expression, dict):
        raise FilterCompileError("Filter expression must be a JSON object")
    if not expression:
        raise FilterCompileError("Filter expression must not be empty")
    compiled = CompiledFilters()
    compiled.q = _compile_node(expression, 1, True, compiled)
    return compiled


def _compile_node(node, depth, conjunctive, compiled):
    if depth > MAX_FILTER_DEPTH:
        raise FilterCompileError(f"Filter expression is nested deeper than {MAX_FILTER_DEPTH} levels")
    if not isinstance(node, dict):
        raise FilterCompileError("Each filter group must be a JSON object")
    if not node:
        raise FilterCompileError("Filter group must not be empty")

    operators = [key for key in node if key in GROUP_OPERATORS]
    if operators:
        if len(node) > 1:
            raise FilterCompileError(f"Group operator '{operators[0]}' must be the only key of its object")
        return _compile_group(operators[0], node[operators[0]], depth, conjunctive, compiled)

    query = Q()
    for key, value in node.items():
        query &= _compile_leaf(key, value, conjunctive, compiled)
    return query


def _compile_group(operator, operand, depth, conjunctive, compiled):
    if operator == NOT:
        members = operand if isinstance(operand, list) else [operand]
    else:
        members = operand
    if not isinstance(members, list) or not members:
        raise FilterCompileError(f"'{operator}' expects a non-empty list of filter objects")

    child_conjunctive = conjunctive and operator == AND
    query = Q()
    for member in members:
        child = _compile_node(member, depth + 1, child_conjunctive, compiled)
        query = query & child if operator != OR else query | child
    return ~query if operator == NOT else query


def _compile_leaf(key, value, conjunctive, compiled):
    if not isinstance(key, str):
        raise FilterCompileError("Filter field names must be strings")

    if key.startswith(CUSTOM_PROPERTY_PREFIX):
        return _compile_custom_property_leaf(key, value, conjunctive, compiled)

    if key in UNSUPPORTED_FIELDS:
        raise FilterCompileError(f"Filter field '{key}' is not supported: {UNSUPPORTED_FIELDS[key]}", field=key)

    name, lookup = split_field_lookup(key)
    if name is None:
        raise FilterCompileError(f"Unknown filter field '{key}'", field=key)

    field = FILTER_FIELDS[name]
    if lookup not in field.lookups:
        raise FilterCompileError(
            f"Lookup '{lookup}' is not supported on field '{name}'",
            field=name,
            lookup=lookup,
        )

    query = Q(**{_orm_key(field.path, lookup): _leaf_value(name, field, lookup, value)})
    for guard_key, guard_value in field.join_guard:
        query &= Q(**{guard_key: guard_value})
    return query


def _orm_key(path, lookup):
    return path if lookup == EXACT else f"{path}__{lookup}"


def _leaf_value(name, field, lookup, value):
    if lookup == ISNULL:
        if not isinstance(value, bool):
            raise FilterCompileError(f"Lookup '__isnull' on '{name}' expects true or false", field=name, lookup=lookup)
        return value

    if lookup == ICONTAINS:
        if isinstance(value, bool) or not isinstance(value, str) or field.value_type != TEXT_TYPE:
            raise FilterCompileError(f"Lookup '__icontains' on '{name}' expects a string", field=name, lookup=lookup)
        return value

    if lookup in (IN, RANGE):
        if not isinstance(value, (list, tuple)):
            raise FilterCompileError(f"Lookup '__{lookup}' on '{name}' expects a list", field=name, lookup=lookup)
        if lookup == RANGE and len(value) != 2:
            raise FilterCompileError(
                f"Lookup '__range' on '{name}' expects exactly two values", field=name, lookup=lookup
            )
        if not value:
            raise FilterCompileError(f"Lookup '__in' on '{name}' expects a non-empty list", field=name, lookup=lookup)
        return [_coerce(name, field, lookup, item) for item in value]

    return _coerce(name, field, lookup, value)


def _coerce(name, field, lookup, value):
    try:
        return coerce_value(field, value)
    except (ValueError, TypeError) as exc:
        raise FilterCompileError(f"Invalid value for '{name}': {exc}", field=name, lookup=lookup) from exc


def _compile_custom_property_leaf(key, value, conjunctive, compiled):
    try:
        property_id, lookup = split_custom_property_lookup(key)
    except ValueError as exc:
        raise FilterCompileError(f"Invalid custom property filter '{key}'", field=key) from exc
    if not conjunctive:
        raise FilterCompileError(
            f"Custom property filter '{key}' is only supported inside 'and' groups",
            field=key,
        )
    if isinstance(value, (list, tuple, dict)):
        raise FilterCompileError(f"Custom property filter '{key}' expects a single value", field=key, lookup=lookup)
    compiled.custom_properties.append(CustomPropertyFilter(property_id=property_id, lookup=lookup, value=value))
    return Q()
