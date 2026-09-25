# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Turn a PQL string or a `filters` expression into ORM filters.

`plane.utils.pql.parser` and `plane.utils.pql.filters` are both pure: the
parser emits placeholders for the constructs it cannot resolve on its own, and
the compiler rejects every placeholder it is handed. This module is the only
place that resolves them, using the request user, the clock and the database:

    {"$currentUser": true}          -> the request user's id
    {"$now": {"seconds": N}}        -> that offset from now
    {"$childOf": "PROJ-12"}         -> {"parent_id": "<work item id>"}
    {"$descendantOf": "PROJ-12"}    -> {"ancestor_id": "<work item id>"}

It also resolves names. A person writes `state = "Paid"`, `type = "Invoice"`
or `cf["Amount"] > 1000`; the compiler needs ids. Every value of a UUID field
that is not a UUID is looked up by name in the workspace (and project, when
the query is project scoped), case-insensitively. A name that matches several
rows, say a state called "Paid" in three projects, matches all of them.

Custom property leaves compile through `_custom_property_resolver`, which
turns `cf[...]` into an `EXISTS` on the property's value rows, so they work
under `OR` and `NOT` like any other field.
"""

import json
import re
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from plane.db.models import (
    Cycle,
    Issue,
    IssueProperty,
    IssueType,
    Label,
    Module,
    Project,
    State,
    User,
)
from plane.utils.issue_property import PropertyValueError, build_custom_property_lookup_q
from plane.utils.pql.fields import (
    ANCESTOR_FIELD,
    CUSTOM_PROPERTY_PREFIX,
    EXACT,
    FIELD_ALIASES,
    FILTER_FIELDS,
    IN,
    UNSUPPORTED_FIELDS,
    UUID_TYPE,
    is_uuid,
    split_field_lookup,
)
from plane.utils.pql.filters import FilterCompileError, compile_filters
from plane.utils.pql.lexer import PQLSyntaxError
from plane.utils.pql.parser import (
    CHILD_OF_PLACEHOLDER,
    CURRENT_USER_PLACEHOLDER,
    DESCENDANT_OF_PLACEHOLDER,
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


class QueryContext:
    """What resolving a query needs besides the query: who asks, where, when."""

    def __init__(self, user, slug, project_id=None, now=None):
        self.user = user
        self.slug = slug
        self.project_id = str(project_id) if project_id else None
        self.now = now or timezone.now()


def compile_pql(source, user, slug, project_id=None, now=None):
    """Parse and compile a PQL string for `user` in the workspace `slug`.

    Raises `WorkItemFilterError` with the payload for a 400.
    """
    try:
        expression = parse_pql(source)
    except PQLSyntaxError as exc:
        raise WorkItemFilterError(exc.as_dict()) from exc
    return compile_query(expression, user, slug, project_id=project_id, now=now)


def compile_query(expression, user, slug, project_id=None, now=None):
    """Resolve and compile a `filters` expression for `user` in workspace `slug`.

    Returns a `CompiledFilters` whose `q` is complete: custom property leaves
    are compiled in, nothing is left on `custom_properties`.
    Raises `WorkItemFilterError` with the payload for a 400.
    """
    context = QueryContext(user, slug, project_id=project_id, now=now)
    expression = _substitute(expression, context)
    expression = _resolve_names(expression, context)
    try:
        return compile_filters(expression, custom_property_resolver=_custom_property_resolver(context))
    except FilterCompileError as exc:
        raise WorkItemFilterError(exc.as_dict()) from exc


def compile_work_item_filters(request, slug, project_id=None):
    """Compile the request's `pql` or `filters` parameter.

    Returns a `CompiledFilters`, or None when neither parameter is set.
    """
    raw_pql = request.GET.get("pql")
    raw_filters = request.GET.get("filters")

    if raw_pql and raw_filters:
        raise WorkItemFilterError({"error": "Provide either 'pql' or 'filters', not both"})

    if raw_pql:
        return compile_pql(raw_pql, request.user, slug, project_id=project_id)
    if raw_filters:
        try:
            expression = json.loads(raw_filters)
        except ValueError as exc:
            raise WorkItemFilterError({"error": "'filters' must be a JSON encoded object"}) from exc
        return compile_query(expression, request.user, slug, project_id=project_id)
    return None


def apply_work_item_filters(queryset, compiled, slug=None, project_id=None):
    """Apply a `CompiledFilters` to a work item queryset."""
    if compiled is None:
        return queryset
    if compiled.custom_properties:
        # Only reachable for a `CompiledFilters` built without a resolver.
        raise WorkItemFilterError({"error": "Custom property filters were not resolved"})
    return queryset.filter(compiled.q).distinct()


def resolve_group_by(name, parameter):
    """Resolve a `group_by` / `sub_group_by` name to `(name, orm_path)`."""
    resolved = FIELD_ALIASES.get(name, name)
    if resolved in UNSUPPORTED_FIELDS:
        raise WorkItemFilterError(
            {"error": f"'{parameter}' field '{name}' is not supported: {UNSUPPORTED_FIELDS[resolved]}", "field": name}
        )
    field = FILTER_FIELDS.get(resolved)
    if field is None or not field.groupable:
        raise WorkItemFilterError({"error": f"Unknown '{parameter}' field '{name}'", "field": name})
    return resolved, field


# ---------------------------------------------------------------------------
# Placeholders
# ---------------------------------------------------------------------------


def _substitute(node, context):
    """Replace every parser placeholder in the AST with a resolved value."""
    if isinstance(node, list):
        return [_substitute(item, context) for item in node]
    if not isinstance(node, dict):
        return node
    if len(node) == 1:
        key, value = next(iter(node.items()))
        if key == CHILD_OF_PLACEHOLDER:
            return {PARENT_FIELD: _resolve_work_item_identifier(value, context)}
        if key == DESCENDANT_OF_PLACEHOLDER:
            return {ANCESTOR_FIELD: _resolve_work_item_identifier(value, context)}
        if key == CURRENT_USER_PLACEHOLDER and value is True:
            return str(context.user.id)
        if key == NOW_PLACEHOLDER and isinstance(value, dict):
            return context.now + timedelta(seconds=value.get("seconds", 0))
    return {key: _substitute(value, context) for key, value in node.items()}


def _resolve_work_item_identifier(identifier, context):
    """Resolve `PROJ-12` to the id of a work item the caller can see."""
    match = WORK_ITEM_IDENTIFIER_RE.match(identifier.strip()) if isinstance(identifier, str) else None
    if match is None:
        raise WorkItemFilterError({"error": f"expected a work item identifier such as PROJ-12, got '{identifier}'"})
    work_item_id = (
        _visible_work_items(context)
        .filter(project__identifier__iexact=match.group(1), sequence_id=int(match.group(2)))
        .values_list("id", flat=True)
        .first()
    )
    # One message for both "no such work item" and "not yours to see".
    if work_item_id is None:
        raise WorkItemFilterError({"error": f"No work item '{identifier}' is visible to you"})
    return str(work_item_id)


def _visible_work_items(context):
    return Issue.objects.filter(
        workspace__slug=context.slug,
        project__project_projectmember__member=context.user,
        project__project_projectmember__is_active=True,
    )


# ---------------------------------------------------------------------------
# Names
# ---------------------------------------------------------------------------


def _resolve_names(node, context):
    """Replace names in UUID-typed leaves with the ids they name."""
    if isinstance(node, list):
        return [_resolve_names(item, context) for item in node]
    if not isinstance(node, dict):
        return node
    resolved = {}
    for key, value in node.items():
        if key in ("and", "or", "not"):
            resolved[key] = _resolve_names(value, context)
            continue
        if not isinstance(key, str) or key.startswith(CUSTOM_PROPERTY_PREFIX):
            resolved[key] = value
            continue
        name, lookup = split_field_lookup(key)
        if name is None or lookup not in (EXACT, IN) or FILTER_FIELDS[name].value_type != UUID_TYPE:
            resolved[key] = value
            continue
        resolver = NAME_RESOLVERS.get(name)
        values = value if isinstance(value, list) else [value]
        if resolver is None or all(is_uuid(item) for item in values):
            resolved[key] = value
            continue
        ids = []
        for item in values:
            if is_uuid(item):
                ids.append(str(item))
            else:
                ids.extend(resolver(item, context))
        if lookup == EXACT and len(ids) == 1:
            resolved[key] = ids[0]
        else:
            resolved[f"{name}__{IN}"] = ids
    return resolved


def _name_of(value):
    if isinstance(value, bool) or not isinstance(value, str) or not value.strip():
        raise WorkItemFilterError({"error": f"expected a name or an id, got {value!r}"})
    return value.strip()


def _ids(queryset, what, raw):
    ids = [str(row) for row in queryset.values_list("id", flat=True).distinct()]
    if not ids:
        raise WorkItemFilterError({"error": f"No {what} named '{raw}' is visible to you"})
    return ids


def _project_scope(context, field="project_id"):
    return {field: context.project_id} if context.project_id else {}


def _member_projects(context, prefix="project"):
    return {
        f"{prefix}__project_projectmember__member": context.user,
        f"{prefix}__project_projectmember__is_active": True,
    }


def _resolve_state(value, context):
    name = _name_of(value)
    queryset = State.objects.filter(
        workspace__slug=context.slug, name__iexact=name, **_project_scope(context), **_member_projects(context)
    )
    return _ids(queryset, "state", name)


def _resolve_type(value, context):
    name = _name_of(value)
    queryset = IssueType.objects.filter(workspace__slug=context.slug, name__iexact=name)
    if context.project_id:
        queryset = queryset.filter(
            project_issue_types__project_id=context.project_id, project_issue_types__deleted_at__isnull=True
        )
    return _ids(queryset, "work item type", name)


def _resolve_label(value, context):
    name = _name_of(value)
    queryset = Label.objects.filter(workspace__slug=context.slug, name__iexact=name)
    if context.project_id:
        queryset = queryset.filter(Q(project_id=context.project_id) | Q(project__isnull=True))
    return _ids(queryset, "label", name)


def _resolve_member(value, context):
    name = _name_of(value)
    queryset = User.objects.filter(
        member_workspace__workspace__slug=context.slug, member_workspace__is_active=True
    ).filter(Q(display_name__iexact=name) | Q(email__iexact=name))
    return _ids(queryset, "member", name)


def _resolve_project(value, context):
    name = _name_of(value)
    queryset = (
        Project.objects.filter(workspace__slug=context.slug)
        .filter(Q(identifier__iexact=name) | Q(name__iexact=name))
        .filter(project_projectmember__member=context.user, project_projectmember__is_active=True)
    )
    return _ids(queryset, "project", name)


def _resolve_cycle(value, context):
    name = _name_of(value)
    queryset = Cycle.objects.filter(
        workspace__slug=context.slug, name__iexact=name, **_project_scope(context), **_member_projects(context)
    )
    return _ids(queryset, "cycle", name)


def _resolve_module(value, context):
    name = _name_of(value)
    queryset = Module.objects.filter(
        workspace__slug=context.slug, name__iexact=name, **_project_scope(context), **_member_projects(context)
    )
    return _ids(queryset, "module", name)


def _resolve_work_item(value, context):
    return [_resolve_work_item_identifier(_name_of(value), context)]


NAME_RESOLVERS = {
    "state_id": _resolve_state,
    "type_id": _resolve_type,
    "labels__id": _resolve_label,
    "assignees__id": _resolve_member,
    "created_by": _resolve_member,
    "project_id": _resolve_project,
    "cycle_id": _resolve_cycle,
    "issue_module__module_id": _resolve_module,
    PARENT_FIELD: _resolve_work_item,
    ANCESTOR_FIELD: _resolve_work_item,
}


# ---------------------------------------------------------------------------
# Custom properties
# ---------------------------------------------------------------------------


def _custom_property_resolver(context):
    def resolve(reference, lookup, value):
        properties = _custom_properties(reference, context)
        query = Q()
        for property_obj in properties:
            try:
                query |= build_custom_property_lookup_q(property_obj, lookup, value)
            except PropertyValueError as exc:
                raise FilterCompileError(f'cf["{reference}"]: {exc}', field=reference, lookup=lookup) from exc
        return query

    return resolve


def _custom_properties(reference, context):
    """The properties `cf[<reference>]` names: one by id, one per project by name."""
    queryset = IssueProperty.objects.filter(
        workspace__slug=context.slug, **_project_scope(context), **_member_projects(context)
    )
    if is_uuid(reference):
        queryset = queryset.filter(id=reference)
    else:
        queryset = queryset.filter(Q(display_name__iexact=reference) | Q(name__iexact=reference))
    properties = list(queryset.distinct())
    if not properties:
        raise FilterCompileError(f"No custom property '{reference}' is visible to you", field=reference)
    return properties
