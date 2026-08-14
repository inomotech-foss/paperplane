# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Turn the `pql` and `filters` request parameters into ORM filters.

`plane.utils.pql.parser` and `plane.utils.pql.filters` are both pure: the
parser emits placeholders for the three constructs it cannot resolve on its
own, and the compiler rejects every placeholder it is handed. This module is
the only place that resolves them, using the request user, the clock and the
database:

    {"$currentUser": true}          -> the request user's id
    {"$now": {"seconds": N}}        -> that offset from now
    {"$childOf": "PROJ-12"}         -> {"parent_id": "<work item id>"}

Custom property leaves compile to an empty `Q` and are collected on
`CompiledFilters.custom_properties`, so applying only `q` would return
everything. `apply_work_item_filters` applies both.
"""

import json
import re
from datetime import timedelta

from django.utils import timezone

from plane.db.models import Issue
from plane.utils.issue_property import build_issue_property_filters
from plane.utils.pql.fields import (
    CUSTOM_PROPERTY_PREFIX,
    EXACT,
    FIELD_ALIASES,
    FILTER_FIELDS,
    UNSUPPORTED_FIELDS,
)
from plane.utils.pql.filters import FilterCompileError, compile_filters
from plane.utils.pql.lexer import PQLSyntaxError
from plane.utils.pql.parser import (
    CHILD_OF_PLACEHOLDER,
    CURRENT_USER_PLACEHOLDER,
    NOW_PLACEHOLDER,
    parse_pql,
)

PARENT_FIELD = "parent_id"

WORK_ITEM_IDENTIFIER_RE = re.compile(r"^([A-Za-z0-9]+)-(\d+)$")


class WorkItemFilterError(Exception):
    """A rejected filter request, carrying the response body for a 400."""

    def __init__(self, payload):
        super().__init__(payload.get("error", "Invalid filter"))
        self.payload = payload


def compile_work_item_filters(request, slug):
    """Compile the request's `pql` or `filters` parameter.

    Returns a `CompiledFilters`, or None when neither parameter is set.
    """
    raw_pql = request.GET.get("pql")
    raw_filters = request.GET.get("filters")

    if raw_pql and raw_filters:
        raise WorkItemFilterError({"error": "Provide either 'pql' or 'filters', not both"})

    if raw_pql:
        try:
            expression = parse_pql(raw_pql)
        except PQLSyntaxError as exc:
            raise WorkItemFilterError(exc.as_dict()) from exc
    elif raw_filters:
        try:
            expression = json.loads(raw_filters)
        except ValueError as exc:
            raise WorkItemFilterError({"error": "'filters' must be a JSON encoded object"}) from exc
    else:
        return None

    expression = _substitute(expression, _Context(request.user, slug, timezone.now()))
    try:
        return compile_filters(expression)
    except FilterCompileError as exc:
        raise WorkItemFilterError(exc.as_dict()) from exc


def apply_work_item_filters(queryset, compiled, slug, project_id=None):
    """Apply a `CompiledFilters` to a work item queryset."""
    if compiled is None:
        return queryset
    queryset = queryset.filter(compiled.q)
    for property_filter in _custom_property_filters(compiled, slug, project_id):
        queryset = queryset.filter(**property_filter)
    return queryset.distinct()


def resolve_group_by(name, parameter):
    """Resolve a `group_by` / `sub_group_by` name to `(name, orm_path)`."""
    resolved = FIELD_ALIASES.get(name, name)
    if resolved in UNSUPPORTED_FIELDS:
        raise WorkItemFilterError(
            {"error": f"'{parameter}' field '{name}' is not supported: {UNSUPPORTED_FIELDS[resolved]}", "field": name}
        )
    field = FILTER_FIELDS.get(resolved)
    if field is None:
        raise WorkItemFilterError({"error": f"Unknown '{parameter}' field '{name}'", "field": name})
    return resolved, field


def _custom_property_filters(compiled, slug, project_id):
    if not compiled.custom_properties:
        return []
    query_params = {}
    for custom_property in compiled.custom_properties:
        suffix = "" if custom_property.lookup == EXACT else f"__{custom_property.lookup}"
        query_params[f"{CUSTOM_PROPERTY_PREFIX}{custom_property.property_id}{suffix}"] = custom_property.value
    filters, error = build_issue_property_filters(query_params, slug, project_id)
    if error:
        raise WorkItemFilterError({"error": error})
    return filters


class _Context:
    def __init__(self, user, slug, now):
        self.user = user
        self.slug = slug
        self.now = now


def _substitute(node, context):
    """Replace every parser placeholder in the AST with a resolved value."""
    if isinstance(node, list):
        return [_substitute(item, context) for item in node]
    if not isinstance(node, dict):
        return node
    if len(node) == 1:
        key, value = next(iter(node.items()))
        if key == CHILD_OF_PLACEHOLDER:
            return {PARENT_FIELD: _resolve_child_of(value, context)}
        if key == CURRENT_USER_PLACEHOLDER and value is True:
            return str(context.user.id)
        if key == NOW_PLACEHOLDER and isinstance(value, dict):
            return context.now + timedelta(seconds=value.get("seconds", 0))
    return {key: _substitute(value, context) for key, value in node.items()}


def _resolve_child_of(identifier, context):
    """Resolve `PROJ-12` to the id of a work item the caller can see."""
    match = WORK_ITEM_IDENTIFIER_RE.match(identifier.strip()) if isinstance(identifier, str) else None
    if match is None:
        raise WorkItemFilterError(
            {"error": f"childOf() expects a work item identifier such as PROJ-12, got '{identifier}'"}
        )
    parent_id = (
        Issue.objects.filter(
            workspace__slug=context.slug,
            project__identifier__iexact=match.group(1),
            sequence_id=int(match.group(2)),
            project__project_projectmember__member=context.user,
            project__project_projectmember__is_active=True,
        )
        .values_list("id", flat=True)
        .first()
    )
    # One message for both "no such work item" and "not yours to see".
    if parent_id is None:
        raise WorkItemFilterError({"error": f"No work item '{identifier}' is visible to you"})
    return str(parent_id)
