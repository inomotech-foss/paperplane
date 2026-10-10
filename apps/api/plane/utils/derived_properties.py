# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Property values derived from the work item hierarchy: inherited, looked up, rolled up.

A property's `derivation` says where its values come from (see
`PropertyDerivationChoices`). Derived values are materialized as ordinary
`IssuePropertyValue` rows with `is_derived=True`, so every reader (filters, the query
language, dashboards, exports, the SDK) sees them without knowing about derivation.

`refresh_derived_values(project_id)` recomputes all of a project's derived values from
scratch and writes only the rows that changed. It loads the project's tree once and
works in memory, which keeps it cycle-safe and cheap for projects of a few thousand
work items. Writes that can change a derived value call `schedule_derived_refresh()`;
bulk jobs wrap themselves in `deferred_derived_refresh()` to refresh once at the end.
"""

# Python imports
import logging
import threading
import uuid
from contextlib import contextmanager
from datetime import date, datetime, time
from datetime import timezone as dt_timezone
from decimal import Decimal

# Django imports
from django.db import transaction

# Third party imports
from rest_framework import serializers

# Module imports
from plane.db.models import (
    Issue,
    IssueProperty,
    IssuePropertyValue,
    Project,
    ProjectIssueType,
    PropertyDerivationChoices,
    PropertyRelationTypeChoices,
    PropertyTypeChoices,
)
from plane.utils.issue_hierarchy import IssueTree
from plane.utils.issue_type import effective_type_id, project_default_type_id

logger = logging.getLogger("plane.api")

VALUE_COLUMNS = (
    "value_text",
    "value_number",
    "value_option_id",
    "value_date",
    "value_boolean",
    "value_user_id",
    "value_issue_id",
)

# the value_number column holds 10 decimal places
DECIMAL_PLACES = Decimal("1e-10")

ROLLUP_BUILTIN_SOURCES = ("items", "start_date", "target_date")
ROLLUP_SCOPES = ("children", "descendants")
NUMBER_FUNCTIONS = ("sum", "avg", "min", "max", "count")
DATE_FUNCTIONS = ("earliest", "latest", "count")
BOOLEAN_FUNCTIONS = ("count_true", "percent_true", "count")
DATE_RESULT_FUNCTIONS = ("earliest", "latest")

SOURCE_DERIVATIONS = (PropertyDerivationChoices.NONE, PropertyDerivationChoices.INHERIT)


# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------


class DerivationConfigError(serializers.ValidationError):
    """A derivation setting the API rejects. Its message is written for the caller and is
    reported on `derivation_config`, so a serializer can let it propagate as it is."""

    def __init__(self, message):
        super().__init__({"derivation_config": message})


def _as_uuid(raw, what):
    try:
        return uuid.UUID(str(raw))
    except (TypeError, ValueError):
        raise DerivationConfigError(f"{what} must be an id")


def _project_issue_type(project_id, raw, what="issue_type"):
    issue_type_id = _as_uuid(raw, what)
    if not ProjectIssueType.objects.filter(project_id=project_id, issue_type_id=issue_type_id).exists():
        raise DerivationConfigError(f"{what} is not a work item type of this project")
    return str(issue_type_id)


def _source_property(project_id, raw, instance):
    source_id = _as_uuid(raw, "source")
    if instance is not None and source_id == instance.id:
        raise DerivationConfigError("A property cannot be derived from itself")
    source = IssueProperty.objects.filter(project_id=project_id, pk=source_id).first()
    if source is None:
        raise DerivationConfigError("source is not a property of this project")
    if source.derivation not in SOURCE_DERIVATIONS:
        raise DerivationConfigError(
            f"'{source.display_name}' is itself looked up or rolled up; "
            "use a property people set, or one inherited from the parent"
        )
    return source


def rollup_functions_for(source):
    """The functions a roll-up over `source` (a property or a built-in field) offers."""
    if source == "items":
        return ("count",)
    if source in ("start_date", "target_date"):
        return DATE_FUNCTIONS
    if source.property_type == PropertyTypeChoices.DECIMAL:
        return NUMBER_FUNCTIONS
    if source.property_type == PropertyTypeChoices.DATETIME:
        return DATE_FUNCTIONS
    if source.property_type == PropertyTypeChoices.BOOLEAN:
        return BOOLEAN_FUNCTIONS
    return ("count",)


def validate_derivation(project_id, attrs, instance=None):
    """Check a property's derivation settings; return the normalized `derivation_config`.

    `attrs` holds the incoming (partial) fields; missing ones come from `instance`.
    Raises DerivationConfigError, which the API reports on `derivation_config`.
    """

    def get(field, default=None):
        if field in attrs:
            return attrs[field]
        return getattr(instance, field, default) if instance is not None else default

    derivation = get("derivation") or PropertyDerivationChoices.NONE
    config = get("derivation_config") or {}
    property_type = get("property_type")
    relation_type = get("relation_type")
    is_multi = bool(get("is_multi", False))
    if not isinstance(config, dict):
        raise DerivationConfigError("derivation_config must be an object")

    is_issue_relation = (
        property_type == PropertyTypeChoices.RELATION and relation_type == PropertyRelationTypeChoices.ISSUE
    )

    if instance is not None and derivation != instance.derivation:
        was_manual = instance.derivation in SOURCE_DERIVATIONS
        becomes_computed = derivation not in SOURCE_DERIVATIONS
        if was_manual and becomes_computed and instance.values.filter(is_derived=False).exists():
            raise DerivationConfigError(
                "This property holds values people set; it can only become looked up or rolled up while it is empty"
            )
        if becomes_computed and dependents_of(instance):
            raise DerivationConfigError("Other properties are derived from this one; it has to stay a source")

    if derivation in (PropertyDerivationChoices.LOOKUP, PropertyDerivationChoices.ROLLUP) and get("is_required"):
        raise DerivationConfigError("A looked up or rolled up property cannot be required")

    if derivation in SOURCE_DERIVATIONS:
        if is_issue_relation:
            raise DerivationConfigError("A work item property can only take its value from an ancestor (LOOKUP)")
        return {}

    if derivation == PropertyDerivationChoices.LOOKUP:
        issue_type = _project_issue_type(project_id, config.get("issue_type"))
        include_self = config.get("include_self", True)
        if not isinstance(include_self, bool):
            raise DerivationConfigError("include_self must be true or false")
        source = config.get("source", "item")
        if source == "item":
            if not is_issue_relation:
                raise DerivationConfigError(
                    "Looking up the ancestor itself needs a RELATION property with relation_type ISSUE"
                )
            return {"issue_type": issue_type, "source": "item", "include_self": include_self}
        source_property = _source_property(project_id, source, instance)
        if (
            source_property.property_type != property_type
            or bool(source_property.is_multi) != is_multi
            or (property_type == PropertyTypeChoices.RELATION and source_property.relation_type != relation_type)
        ):
            raise DerivationConfigError(
                f"The property must have the same type as '{source_property.display_name}' to show its value"
            )
        return {"issue_type": issue_type, "source": str(source_property.id), "include_self": include_self}

    if derivation == PropertyDerivationChoices.ROLLUP:
        raw_source = config.get("source")
        if raw_source in ROLLUP_BUILTIN_SOURCES:
            source, source_key = raw_source, raw_source
        else:
            source = _source_property(project_id, raw_source, instance)
            source_key = str(source.id)
        function = config.get("function")
        allowed = rollup_functions_for(source)
        if function not in allowed:
            raise DerivationConfigError(f"function must be one of {', '.join(allowed)} for this source")
        expected_type = (
            PropertyTypeChoices.DATETIME if function in DATE_RESULT_FUNCTIONS else PropertyTypeChoices.DECIMAL
        )
        if property_type != expected_type or is_multi:
            raise DerivationConfigError(f"A roll-up with '{function}' needs a {expected_type} property")
        scope = config.get("scope", "descendants")
        if scope not in ROLLUP_SCOPES:
            raise DerivationConfigError("scope must be 'children' or 'descendants'")
        include_self = config.get("include_self", False)
        if not isinstance(include_self, bool):
            raise DerivationConfigError("include_self must be true or false")
        issue_type = config.get("issue_type")
        return {
            "source": source_key,
            "function": function,
            "scope": scope,
            "issue_type": _project_issue_type(project_id, issue_type) if issue_type else None,
            "include_self": include_self,
        }

    raise DerivationConfigError(f"Unknown derivation '{derivation}'")


def dependents_of(property_obj):
    """The looked up and rolled up properties that read `property_obj`'s values."""
    return list(
        IssueProperty.objects.filter(
            project_id=property_obj.project_id,
            derivation__in=[PropertyDerivationChoices.LOOKUP, PropertyDerivationChoices.ROLLUP],
            derivation_config__source=str(property_obj.id),
        ).exclude(pk=property_obj.pk)
    )


# --------------------------------------------------------------------------
# Computation
# --------------------------------------------------------------------------


def _cells(row):
    """The (column, value) pairs a value row holds, normalized for comparison."""
    cells = []
    for column in VALUE_COLUMNS:
        value = row[column]
        if value is None:
            continue
        if column == "value_number":
            value = Decimal(value).quantize(DECIMAL_PLACES)
        elif column == "value_date":
            value = value.astimezone(dt_timezone.utc)
        cells.append((column, value))
    return cells


def _load_values(project_id, property_ids, issue_ids, is_derived):
    """`{property_id: {issue_id: frozenset(cells)}}` of the value rows of live work items."""
    values = {}
    if not property_ids:
        return values
    rows = IssuePropertyValue.objects.filter(
        project_id=project_id, property_id__in=property_ids, is_derived=is_derived, deleted_at__isnull=True
    ).values("id", "property_id", "issue_id", *VALUE_COLUMNS)
    for row in rows:
        if row["issue_id"] not in issue_ids:
            continue
        cells = _cells(row)
        if not cells:
            continue
        by_issue = values.setdefault(row["property_id"], {})
        by_issue[row["issue_id"]] = by_issue.get(row["issue_id"], frozenset()) | frozenset(cells)
    return values


def _inherit(tree, own):
    """Effective values of an INHERIT property: own value, else the parent's effective value."""
    effective = {}
    visited = set()
    stack = [(issue_id, None) for issue_id in tree.ids() if tree.parent_id(issue_id) is None]
    while stack:
        issue_id, inherited = stack.pop()
        if issue_id in visited:
            continue
        visited.add(issue_id)
        value = own.get(issue_id) or inherited
        if value:
            effective[issue_id] = value
        stack.extend((child_id, value) for child_id in tree.children(issue_id))
    # members of a parent cycle are unreachable from the roots: they keep their own value only
    for issue_id in tree.ids():
        if issue_id not in visited and own.get(issue_id):
            effective[issue_id] = own[issue_id]
    return effective


def _lookup(tree, config, source_value):
    issue_type_id = uuid.UUID(config["issue_type"])
    include_self = config.get("include_self", True)
    source = config.get("source", "item")
    source_id = None if source == "item" else uuid.UUID(source)
    result = {}
    for issue_id in tree.ids():
        chain = ([issue_id] if include_self else []) + tree.ancestors(issue_id)
        ancestor_id = next(
            (node_id for node_id in chain if tree.node(node_id)["effective_type_id"] == issue_type_id), None
        )
        if ancestor_id is None:
            continue
        value = (
            frozenset({("value_issue_id", ancestor_id)}) if source_id is None else source_value(source_id, ancestor_id)
        )
        if value:
            result[issue_id] = value
    return result


def _as_datetime(value):
    if isinstance(value, datetime):
        return value.astimezone(dt_timezone.utc)
    if isinstance(value, date):
        return datetime.combine(value, time.min, tzinfo=dt_timezone.utc)
    return None


def _rollup(tree, config, source_value, source_properties):
    source = config["source"]
    function = config["function"]
    scope = config.get("scope", "descendants")
    include_self = config.get("include_self", False)
    issue_type_id = uuid.UUID(config["issue_type"]) if config.get("issue_type") else None
    source_property = source_properties.get(uuid.UUID(source)) if source not in ROLLUP_BUILTIN_SOURCES else None

    def extract(issue_id):
        if source == "items":
            return True
        if source in ("start_date", "target_date"):
            return _as_datetime(tree.node(issue_id)[source])
        cells = source_value(source_property.id, issue_id)
        if not cells:
            return None
        if source_property.property_type == PropertyTypeChoices.DECIMAL:
            return next(value for column, value in cells if column == "value_number")
        if source_property.property_type == PropertyTypeChoices.DATETIME:
            return next(value for column, value in cells if column == "value_date")
        if source_property.property_type == PropertyTypeChoices.BOOLEAN:
            return next(value for column, value in cells if column == "value_boolean")
        return True  # any other type only counts whether there is a value

    result = {}
    for issue_id in tree.ids():
        members = list(tree.children(issue_id) if scope == "children" else tree.descendants(issue_id))
        if not members and not include_self:
            continue  # nothing below: no value, rather than a misleading 0
        if include_self:
            members.insert(0, issue_id)
        if issue_type_id is not None:
            members = [member for member in members if tree.node(member)["effective_type_id"] == issue_type_id]
        values = [value for value in (extract(member) for member in members) if value is not None]

        if function == "count":
            value = Decimal(len(values))
        elif not values:
            continue
        elif function == "sum":
            value = sum(values, Decimal(0))
        elif function == "avg":
            value = sum(values, Decimal(0)) / len(values)
        elif function in ("min", "earliest"):
            value = min(values)
        elif function in ("max", "latest"):
            value = max(values)
        elif function == "count_true":
            value = Decimal(sum(1 for flag in values if flag))
        elif function == "percent_true":
            value = Decimal(100) * sum(1 for flag in values if flag) / len(values)
        else:
            continue

        if function in DATE_RESULT_FUNCTIONS:
            result[issue_id] = frozenset({("value_date", value)})
        else:
            result[issue_id] = frozenset({("value_number", Decimal(value).quantize(DECIMAL_PLACES))})
    return result


def compute_derived_values(tree, properties, source_properties, own, effective_inherited):
    """The derived value of every (property, work item): `{property_id: {issue_id: cells}}`.

    `source_properties` are the properties the derived ones read, by id; `own` holds the
    values people set and `effective_inherited` the effective values of the INHERIT
    properties. Free of database access, so it can be tested on its own.
    """

    def source_value(property_id, issue_id):
        if property_id in effective_inherited:
            return effective_inherited[property_id].get(issue_id)
        return own.get(property_id, {}).get(issue_id)

    desired = {}
    for prop in properties:
        config = prop.derivation_config or {}
        if prop.derivation == PropertyDerivationChoices.INHERIT:
            own_values = own.get(prop.id, {})
            desired[prop.id] = {
                issue_id: value
                for issue_id, value in effective_inherited.get(prop.id, {}).items()
                if issue_id not in own_values
            }
        elif prop.derivation == PropertyDerivationChoices.LOOKUP:
            desired[prop.id] = _lookup(tree, config, source_value)
        elif prop.derivation == PropertyDerivationChoices.ROLLUP:
            desired[prop.id] = _rollup(tree, config, source_value, source_properties)
    return desired


def refresh_derived_values(project_id):
    """Recompute and store every derived property value of a project.

    Returns `{"created": n, "deleted": m}`: how many value rows were written and removed.
    """
    stale = IssuePropertyValue.objects.filter(project_id=project_id, is_derived=True).exclude(
        property__derivation__in=[
            PropertyDerivationChoices.INHERIT,
            PropertyDerivationChoices.LOOKUP,
            PropertyDerivationChoices.ROLLUP,
        ],
        property__deleted_at__isnull=True,
    )
    deleted = stale.delete(soft=False)[0]

    properties = list(
        IssueProperty.objects.filter(project_id=project_id).exclude(derivation=PropertyDerivationChoices.NONE)
    )
    if not properties:
        return {"created": 0, "deleted": deleted}

    tree = IssueTree.for_project(
        project_id,
        fields=("effective_type_id", "start_date", "target_date"),
        queryset=Issue.issue_objects.filter(project_id=project_id).annotate(effective_type_id=effective_type_id()),
    )
    issue_ids = set(tree.ids())

    source_ids = {prop.id for prop in properties if prop.derivation == PropertyDerivationChoices.INHERIT}
    for prop in properties:
        source = (prop.derivation_config or {}).get("source")
        if (
            prop.derivation != PropertyDerivationChoices.INHERIT
            and source
            and source
            not in (
                "item",
                *ROLLUP_BUILTIN_SOURCES,
            )
        ):
            source_ids.add(uuid.UUID(source))
    own = _load_values(project_id, source_ids, issue_ids, is_derived=False)
    source_properties = {prop.id: prop for prop in IssueProperty.objects.filter(pk__in=source_ids)}
    effective = {
        prop_id: _inherit(tree, own.get(prop_id, {}))
        for prop_id, prop in source_properties.items()
        if prop.derivation == PropertyDerivationChoices.INHERIT
    }
    desired = compute_derived_values(tree, properties, source_properties, own, effective)

    # diff against what is stored
    existing = {}
    for row in IssuePropertyValue.objects.filter(
        project_id=project_id, property_id__in=[prop.id for prop in properties], is_derived=True
    ).values("id", "property_id", "issue_id", *VALUE_COLUMNS):
        if row["issue_id"] not in issue_ids:
            continue  # archived / deleted work items keep what they had until they come back
        entry = existing.setdefault((row["property_id"], row["issue_id"]), {"ids": [], "cells": frozenset()})
        entry["ids"].append(row["id"])
        entry["cells"] = entry["cells"] | frozenset(_cells(row))

    workspace_id = Project.objects.filter(pk=project_id).values_list("workspace_id", flat=True).first()
    to_delete = []
    to_create = []
    for prop in properties:
        wanted = desired.get(prop.id, {})
        for issue_id in issue_ids:
            want = wanted.get(issue_id)
            have = existing.get((prop.id, issue_id))
            if (want or frozenset()) == (have["cells"] if have else frozenset()):
                continue
            if have:
                to_delete.extend(have["ids"])
            for column, value in want or ():
                to_create.append(
                    IssuePropertyValue(
                        issue_id=issue_id,
                        property_id=prop.id,
                        project_id=project_id,
                        workspace_id=workspace_id,
                        is_derived=True,
                        **{column: value},
                    )
                )

    with transaction.atomic():
        if to_delete:
            deleted += IssuePropertyValue.objects.filter(pk__in=to_delete).delete(soft=False)[0]
        if to_create:
            IssuePropertyValue.objects.bulk_create(to_create, batch_size=1000)
    return {"created": len(to_create), "deleted": deleted}


# --------------------------------------------------------------------------
# When to recompute
# --------------------------------------------------------------------------

_local = threading.local()


def project_has_derived_properties(project_id):
    return (
        IssueProperty.objects.filter(project_id=project_id).exclude(derivation=PropertyDerivationChoices.NONE).exists()
    )


def refresh_derived_values_safely(project_id):
    """`refresh_derived_values`, logging instead of raising."""
    try:
        refresh_derived_values(project_id)
    except Exception:
        # a failed recompute must not fail the write that triggered it; the next write
        # or `manage.py recompute_derived_properties` repairs the values
        logger.exception("Recomputing derived property values of project %s failed", project_id)


def refresh_derived_values_now(project_id):
    """Recompute right away (for endpoints whose response shows the refreshed values).

    A no-op for projects without derived properties; failures are logged, not raised.
    """
    if project_id and project_has_derived_properties(project_id):
        refresh_derived_values_safely(project_id)


def schedule_derived_refresh(project_id):
    """Recompute a project's derived values once the current transaction commits.

    A no-op for projects without derived properties. Inside `deferred_derived_refresh()`
    the project is only noted and recomputed when the block ends.
    """
    if not project_id:
        return
    deferred = getattr(_local, "deferred", None)
    if deferred is not None:
        deferred.add(str(project_id))
        return
    if not project_has_derived_properties(project_id):
        return
    transaction.on_commit(lambda: refresh_derived_values_safely(project_id))


@contextmanager
def deferred_derived_refresh():
    """Collect refresh requests (e.g. during an import) and run each project's once at the end.

    Nothing is recomputed when the block raises.
    """
    if getattr(_local, "deferred", None) is not None:
        yield
        return
    _local.deferred = set()
    try:
        yield
    except BaseException:
        _local.deferred = None
        raise
    project_ids, _local.deferred = _local.deferred, None
    for project_id in project_ids:
        if project_has_derived_properties(project_id):
            refresh_derived_values_safely(project_id)


def schedule_refresh_for_issue(issue_id):
    """Refresh the project a work item belongs to (for callers that only hold its id)."""
    project_id = Issue.all_objects.filter(pk=issue_id).values_list("project_id", flat=True).first()
    schedule_derived_refresh(project_id)


# --------------------------------------------------------------------------
# Explaining a work item's derived values
# --------------------------------------------------------------------------


def derived_value_sources(issue, properties):
    """For each derived value of `issue`, the work item it comes from.

    Returns `{property_id: {"source_issue_id": id | None}}` for the given properties that
    hold a derived value on the work item: the ancestor an inherited or looked-up value was
    taken from; None for roll-ups, which come from many.
    """
    derived_ids = set(
        IssuePropertyValue.objects.filter(
            issue=issue, property__in=[prop.id for prop in properties], is_derived=True
        ).values_list("property_id", flat=True)
    )
    if not derived_ids:
        return {}
    chain = []  # ancestors, nearest first
    seen = {issue.id}
    parent_id = issue.parent_id
    while parent_id and parent_id not in seen and len(chain) < 50:
        seen.add(parent_id)
        node = (
            Issue.issue_objects.filter(pk=parent_id)
            .annotate(effective_type_id=effective_type_id())
            .values("id", "parent_id", "effective_type_id")
            .first()
        )
        if node is None:
            break
        chain.append(node)
        parent_id = node["parent_id"]

    sources = {}
    for prop in properties:
        if prop.id not in derived_ids:
            continue
        config = prop.derivation_config or {}
        source_issue_id = None
        if prop.derivation == PropertyDerivationChoices.INHERIT:
            owners = set(
                IssuePropertyValue.objects.filter(
                    property=prop, issue_id__in=[node["id"] for node in chain], is_derived=False
                ).values_list("issue_id", flat=True)
            )
            source_issue_id = next((node["id"] for node in chain if node["id"] in owners), None)
        elif prop.derivation == PropertyDerivationChoices.LOOKUP and config.get("issue_type"):
            wanted = uuid.UUID(config["issue_type"])
            candidates = (
                [{"id": issue.id, "effective_type_id": issue.type_id or project_default_type_id(issue.project_id)}]
                if config.get("include_self", True)
                else []
            ) + chain
            source_issue_id = next((node["id"] for node in candidates if node["effective_type_id"] == wanted), None)
        sources[str(prop.id)] = {"source_issue_id": str(source_issue_id) if source_issue_id else None}
    return sources
