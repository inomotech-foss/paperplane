# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Validate and evaluate dashboard widgets.

A widget (see `plane.db.models.dashboard`) is a PQL query, a metric and up
to two dimensions. `evaluate_widget` turns one into chart data:

    {
        "data": [{"key": "2026-03-01", "name": "Mar 2026", "count": 1250.5, "<series key>": ...}, ...],
        "schema": {"<series key>": "<series name>"},
        "total": 4200,
        "row_count": 17,
    }

which is the shape the analytics charts already consume (`count` carries the
metric value whatever the metric is).

The work items are selected in SQL (the query, the caller's visibility) and
the aggregation happens in Python over one `values()` pass. That keeps a
single code path for everything a dimension can be, native columns, date
buckets, custom properties and "nearest ancestor of type X", and it is what
lets a sales funnel report per customer without a column that stores the
customer on every invoice.
"""

import uuid
import zoneinfo
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation

from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField
from django.db.models import OuterRef, Q, Subquery, UUIDField, Value
from django.db.models.functions import Coalesce

from plane.db.models import (
    Cycle,
    Issue,
    IssueAssignee,
    IssueLabel,
    IssueProperty,
    IssuePropertyOption,
    IssuePropertyValue,
    IssueType,
    Label,
    Module,
    ModuleIssue,
    Project,
    PropertyTypeChoices,
    State,
    User,
    CycleIssue,
)
from plane.utils.issue_property import number_to_json
from plane.utils.pql import WorkItemFilterError, compile_pql, parse_pql
from plane.utils.pql.lexer import PQLSyntaxError

CHART_TYPES = ("number", "bar", "line", "area", "pie", "donut", "table")
METRIC_FUNCTIONS = ("count", "sum", "avg", "min", "max")
DATE_BUCKETS = ("day", "week", "month", "quarter", "year")
DEFAULT_BUCKET = "month"

# Dimensions backed by a column or an annotation of the work item row.
# name -> (row key, multi valued)
NATIVE_DIMENSIONS = {
    "state": ("state_id", False),
    "state_group": ("state__group", False),
    "priority": ("priority", False),
    "type": ("type_id", False),
    "project": ("project_id", False),
    "assignee": ("assignee_ids", True),
    "label": ("label_ids", True),
    "cycle": ("cycle_id", False),
    "module": ("module_ids", True),
    "created_by": ("created_by_id", False),
    "parent": ("parent_id", False),
}
DATE_DIMENSIONS = ("target_date", "start_date", "created_at", "completed_at", "updated_at")

PROPERTY_PREFIX = "property:"
ANCESTOR_PREFIX = "ancestor:"
ESTIMATE_METRIC_FIELD = "estimate_points"

NONE_KEY = "none"
NONE_LABEL = "None"

MAX_ANCESTOR_DEPTH = 25
MAX_FILLED_BUCKETS = 400

PROPERTY_VALUE_COLUMNS = {
    PropertyTypeChoices.TEXT: "value_text",
    PropertyTypeChoices.DECIMAL: "value_number",
    PropertyTypeChoices.OPTION: "value_option_id",
    PropertyTypeChoices.DATETIME: "value_date",
    PropertyTypeChoices.BOOLEAN: "value_boolean",
    PropertyTypeChoices.RELATION: "value_user_id",
}


class WidgetDefinitionError(ValueError):
    """A widget definition the caller must fix; the message is for them."""

    def __init__(self, message, field=None):
        super().__init__(message)
        self.message = message
        self.field = field

    def as_dict(self):
        return {"error": self.message, "field": self.field}


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def validate_widget_definition(data, slug):
    """Normalise and validate the definition part of a widget payload.

    `data` holds `chart_type`, `query`, `metric`, `dimension` and `series`.
    Returns the normalised values as a dict. Raises `WidgetDefinitionError`.
    """
    chart_type = data.get("chart_type") or "bar"
    if chart_type not in CHART_TYPES:
        raise WidgetDefinitionError(f"Unknown chart type '{chart_type}'", field="chart_type")

    query = data.get("query") or ""
    if not isinstance(query, str):
        raise WidgetDefinitionError("The query must be a PQL string", field="query")
    query = query.strip()
    if query:
        try:
            parse_pql(query)
        except PQLSyntaxError as exc:
            raise WidgetDefinitionError(exc.message, field="query") from exc

    properties = _workspace_properties(slug)
    metric = _validate_metric(data.get("metric") or {}, properties)
    dimension = _validate_dimension(data.get("dimension") or {}, properties, slug, "dimension")
    series = _validate_dimension(data.get("series") or {}, properties, slug, "series")
    if series and not dimension:
        raise WidgetDefinitionError("A series needs a dimension to split", field="series")
    if series and series["field"] == dimension["field"]:
        raise WidgetDefinitionError("The series must differ from the dimension", field="series")
    if chart_type == "number" and dimension:
        raise WidgetDefinitionError("A number widget has no dimension", field="dimension")
    if chart_type in ("bar", "line", "area", "pie", "donut") and not dimension:
        raise WidgetDefinitionError(f"A {chart_type} chart needs a dimension", field="dimension")
    if chart_type in ("pie", "donut") and series:
        raise WidgetDefinitionError(f"A {chart_type} chart has no series", field="series")

    return {"chart_type": chart_type, "query": query, "metric": metric, "dimension": dimension, "series": series}


def _validate_metric(metric, properties):
    if not isinstance(metric, dict):
        raise WidgetDefinitionError("The metric must be an object", field="metric")
    function = metric.get("function") or "count"
    if function not in METRIC_FUNCTIONS:
        raise WidgetDefinitionError(f"Unknown metric function '{function}'", field="metric")
    if function == "count":
        return {"function": "count"}
    field = metric.get("field")
    if field == ESTIMATE_METRIC_FIELD:
        return {"function": function, "field": field}
    property_obj = _property_reference(field, properties, "metric")
    if property_obj.property_type != PropertyTypeChoices.DECIMAL:
        raise WidgetDefinitionError(
            f"'{property_obj.display_name}' is not a decimal property, so it cannot be {function}med", field="metric"
        )
    return {"function": function, "field": f"{PROPERTY_PREFIX}{property_obj.id}"}


def _validate_dimension(dimension, properties, slug, field_name):
    if not dimension:
        return {}
    if not isinstance(dimension, dict):
        raise WidgetDefinitionError(f"The {field_name} must be an object", field=field_name)
    field = dimension.get("field")
    if not isinstance(field, str) or not field:
        raise WidgetDefinitionError(f"The {field_name} needs a field", field=field_name)
    bucket = dimension.get("bucket")
    if bucket is not None and bucket not in DATE_BUCKETS:
        raise WidgetDefinitionError(f"Unknown date bucket '{bucket}'", field=field_name)

    if field in NATIVE_DIMENSIONS:
        return {"field": field}
    if field in DATE_DIMENSIONS:
        return {"field": field, "bucket": bucket or DEFAULT_BUCKET}
    if field.startswith(ANCESTOR_PREFIX):
        type_id = _uuid_or_error(field[len(ANCESTOR_PREFIX) :], field_name)
        if not IssueType.objects.filter(workspace__slug=slug, id=type_id).exists():
            raise WidgetDefinitionError("Unknown work item type for the ancestor dimension", field=field_name)
        return {"field": f"{ANCESTOR_PREFIX}{type_id}"}
    if field.startswith(PROPERTY_PREFIX):
        property_obj = _property_reference(field, properties, field_name)
        normalised = {"field": f"{PROPERTY_PREFIX}{property_obj.id}"}
        if property_obj.property_type == PropertyTypeChoices.DATETIME:
            normalised["bucket"] = bucket or DEFAULT_BUCKET
        return normalised
    raise WidgetDefinitionError(f"Unknown {field_name} field '{field}'", field=field_name)


def _property_reference(field, properties, field_name):
    if not isinstance(field, str) or not field.startswith(PROPERTY_PREFIX):
        raise WidgetDefinitionError(f"The {field_name} field must name a custom property", field=field_name)
    property_id = _uuid_or_error(field[len(PROPERTY_PREFIX) :], field_name)
    property_obj = properties.get(property_id)
    if property_obj is None:
        raise WidgetDefinitionError("Unknown custom property", field=field_name)
    return property_obj


def _uuid_or_error(raw, field_name):
    try:
        return str(uuid.UUID(str(raw)))
    except ValueError as exc:
        raise WidgetDefinitionError(f"'{raw}' is not a valid id", field=field_name) from exc


def _workspace_properties(slug):
    return {str(prop.id): prop for prop in IssueProperty.objects.filter(workspace__slug=slug)}


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------


def visible_work_items(user, slug):
    """The work items `user` may see across the workspace.

    Mirrors the workspace views list: active membership, archived projects
    out, and a guest of a project without "guests see everything" only sees
    what they created.
    """
    return Issue.issue_objects.filter(workspace__slug=slug, project__archived_at__isnull=True).filter(
        Q(project__project_projectmember__role__gt=5)
        | Q(project__project_projectmember__role=5, project__guest_view_all_features=True)
        | Q(project__project_projectmember__role=5, project__guest_view_all_features=False, created_by=user),
        project__project_projectmember__member=user,
        project__project_projectmember__is_active=True,
    )


def evaluate_widget(definition, user, slug, queryset=None):
    """Evaluate a normalised widget definition for `user` in workspace `slug`.

    Raises `WidgetDefinitionError` when the query does not resolve.
    """
    queryset = visible_work_items(user, slug) if queryset is None else queryset
    query = definition.get("query") or ""
    if query:
        try:
            compiled = compile_pql(query, user, slug)
        except WorkItemFilterError as exc:
            raise WidgetDefinitionError(exc.payload.get("error", "Invalid query"), field="query") from exc
        queryset = queryset.filter(compiled.q)

    properties = _workspace_properties(slug)
    dimensions = [
        _Dimension(definition.get("dimension") or {}, properties),
        _Dimension(definition.get("series") or {}, properties),
    ]
    metric = _Metric(definition.get("metric") or {"function": "count"})
    timezone = _user_timezone(user)

    rows = list(_annotated(queryset.distinct(), dimensions, metric).values(*_columns(dimensions, metric)))
    for dimension in dimensions:
        if dimension.kind == "ancestor":
            dimension.ancestors = _nearest_ancestors(rows, dimension.type_id, slug)

    groups = defaultdict(_Accumulator)
    total = _Accumulator()
    for row in rows:
        value = metric.value(row)
        total.add(value)
        for key in dimensions[0].keys(row, timezone):
            for series_key in dimensions[1].keys(row, timezone):
                groups[(key, series_key)].add(value)

    labels = _Labels(dimensions, groups, rows, slug)
    data, schema = _shape(groups, dimensions, metric, labels)
    return {
        "data": data,
        "schema": schema,
        "total": metric.result(total),
        "row_count": len(rows),
        "metric": definition.get("metric") or {"function": "count"},
        "dimension": definition.get("dimension") or {},
        "series": definition.get("series") or {},
    }


class _Dimension:
    """What a dimension needs from a row and how it keys it."""

    def __init__(self, spec, properties):
        self.spec = spec
        self.field = spec.get("field")
        self.bucket = spec.get("bucket")
        self.kind = None
        self.row_key = None
        self.multi = False
        self.property = None
        self.type_id = None
        self.ancestors = {}
        if not self.field:
            self.kind = "none"
        elif self.field in NATIVE_DIMENSIONS:
            self.kind = "native"
            self.row_key, self.multi = NATIVE_DIMENSIONS[self.field]
        elif self.field in DATE_DIMENSIONS:
            self.kind = "date"
            self.row_key = self.field
        elif self.field.startswith(ANCESTOR_PREFIX):
            self.kind = "ancestor"
            self.type_id = self.field[len(ANCESTOR_PREFIX) :]
        elif self.field.startswith(PROPERTY_PREFIX):
            self.kind = "property"
            self.property = properties.get(self.field[len(PROPERTY_PREFIX) :])
            if self.property is None:
                raise WidgetDefinitionError("Unknown custom property", field="dimension")
            self.row_key = f"dim_{self.property.id.hex}"
            self.multi = self.property.is_multi_option
        else:
            raise WidgetDefinitionError(f"Unknown dimension field '{self.field}'", field="dimension")

    @property
    def is_time(self):
        return self.kind == "date" or (
            self.kind == "property" and self.property.property_type == PropertyTypeChoices.DATETIME
        )

    def keys(self, row, timezone):
        """The group keys a row falls into; a multi-valued row lands in each."""
        if self.kind == "none":
            return [None]
        if self.kind == "ancestor":
            ancestor = self.ancestors.get(str(row["id"]))
            return [ancestor or NONE_KEY]
        raw = row.get(self.row_key)
        if self.multi:
            values = [str(value) for value in (raw or []) if value is not None]
            return values or [NONE_KEY]
        if raw is None or raw == "":
            return [NONE_KEY]
        if self.is_time:
            return [bucket_start(raw, self.bucket, timezone).isoformat()]
        if isinstance(raw, bool):
            return ["true" if raw else "false"]
        if isinstance(raw, Decimal):
            return [str(number_to_json(raw))]
        return [str(raw)]


class _Metric:
    def __init__(self, spec):
        self.function = spec.get("function") or "count"
        self.field = spec.get("field")
        self.property_id = None
        if self.field and self.field.startswith(PROPERTY_PREFIX):
            self.property_id = self.field[len(PROPERTY_PREFIX) :]

    @property
    def row_key(self):
        if self.function == "count":
            return None
        if self.field == ESTIMATE_METRIC_FIELD:
            return "estimate_point__value"
        return "metric_value"

    def value(self, row):
        if self.function == "count":
            return Decimal(1)
        raw = row.get(self.row_key)
        if raw is None or raw == "":
            return None
        try:
            return Decimal(str(raw))
        except InvalidOperation:
            return None

    def result(self, accumulator):
        if self.function == "count":
            return accumulator.count
        if accumulator.count == 0:
            return 0
        if self.function == "sum":
            return number_to_json(accumulator.total)
        if self.function == "avg":
            return number_to_json((accumulator.total / accumulator.count).quantize(Decimal("0.0001")))
        if self.function == "min":
            return number_to_json(accumulator.minimum)
        return number_to_json(accumulator.maximum)


class _Accumulator:
    __slots__ = ("count", "total", "minimum", "maximum")

    def __init__(self):
        self.count = 0
        self.total = Decimal(0)
        self.minimum = None
        self.maximum = None

    def add(self, value):
        if value is None:
            return
        self.count += 1
        self.total += value
        self.minimum = value if self.minimum is None else min(self.minimum, value)
        self.maximum = value if self.maximum is None else max(self.maximum, value)

    def merge(self, other):
        self.count += other.count
        self.total += other.total
        for value in (other.minimum, other.maximum):
            if value is None:
                continue
            self.minimum = value if self.minimum is None else min(self.minimum, value)
            self.maximum = value if self.maximum is None else max(self.maximum, value)


def _columns(dimensions, metric):
    columns = {"id", "parent_id", "type_id"}
    for dimension in dimensions:
        if dimension.row_key:
            columns.add(dimension.row_key)
        if dimension.kind == "ancestor" or dimension.field == "parent":
            columns.update({"name", "sequence_id", "project__identifier"})
    if metric.row_key:
        columns.add(metric.row_key)
    return sorted(columns)


def _annotated(queryset, dimensions, metric):
    needed = {dimension.row_key for dimension in dimensions if dimension.row_key}
    if "assignee_ids" in needed:
        queryset = queryset.annotate(
            assignee_ids=_id_array(
                IssueAssignee.objects.filter(issue_id=OuterRef("id"), deleted_at__isnull=True), "assignee_id"
            )
        )
    if "label_ids" in needed:
        queryset = queryset.annotate(
            label_ids=_id_array(IssueLabel.objects.filter(issue_id=OuterRef("id"), deleted_at__isnull=True), "label_id")
        )
    if "module_ids" in needed:
        queryset = queryset.annotate(
            module_ids=_id_array(
                ModuleIssue.objects.filter(issue_id=OuterRef("id"), deleted_at__isnull=True), "module_id"
            )
        )
    if "cycle_id" in needed:
        queryset = queryset.annotate(
            cycle_id=Subquery(
                CycleIssue.objects.filter(issue=OuterRef("id"), deleted_at__isnull=True).values("cycle_id")[:1]
            )
        )
    for dimension in dimensions:
        if dimension.kind == "property":
            queryset = queryset.annotate(**{dimension.row_key: _property_annotation(dimension.property)})
    if metric.property_id:
        queryset = queryset.annotate(
            metric_value=Subquery(
                IssuePropertyValue.objects.filter(
                    issue_id=OuterRef("id"), property_id=metric.property_id, deleted_at__isnull=True
                )
                .order_by("-created_at")
                .values("value_number")[:1]
            )
        )
    return queryset


def _id_array(rows, column):
    return Coalesce(
        Subquery(
            rows.order_by().values("issue_id").annotate(arr=ArrayAgg(column, distinct=True)).values("arr"),
            output_field=ArrayField(UUIDField()),
        ),
        Value([], output_field=ArrayField(UUIDField())),
    )


def _property_annotation(property_obj):
    rows = IssuePropertyValue.objects.filter(
        issue_id=OuterRef("id"), property_id=property_obj.id, deleted_at__isnull=True
    )
    if property_obj.is_multi_option:
        return _id_array(rows, "value_option_id")
    column = PROPERTY_VALUE_COLUMNS[property_obj.property_type]
    return Subquery(rows.order_by("-created_at").values(column)[:1])


def _nearest_ancestors(rows, type_id, slug):
    """Map each row id to the id of its nearest ancestor of `type_id`."""
    known = {
        str(row["id"]): (str(row["parent_id"]) if row["parent_id"] else None, str(row["type_id"] or "")) for row in rows
    }
    frontier = {parent for parent, _ in known.values() if parent and parent not in known}
    depth = 0
    while frontier and depth < MAX_ANCESTOR_DEPTH:
        fetched = Issue.objects.filter(id__in=frontier, workspace__slug=slug).values("id", "parent_id", "type_id")
        frontier = set()
        for item in fetched:
            parent = str(item["parent_id"]) if item["parent_id"] else None
            known[str(item["id"])] = (parent, str(item["type_id"] or ""))
            if parent and parent not in known:
                frontier.add(parent)
        depth += 1

    result = {}
    for row in rows:
        current = known[str(row["id"])][0]
        seen = set()
        while current and current not in seen and current in known:
            seen.add(current)
            parent, current_type = known[current]
            if current_type == type_id:
                result[str(row["id"])] = current
                break
            current = parent
    return result


# ---------------------------------------------------------------------------
# Labels and output shape
# ---------------------------------------------------------------------------


class _Labels:
    """Human names for the keys that appear in the result."""

    def __init__(self, dimensions, groups, rows, slug):
        self.slug = slug
        self.by_dimension = []
        for index, dimension in enumerate(dimensions):
            keys = {key[index] for key in groups}
            keys.discard(None)
            keys.discard(NONE_KEY)
            self.by_dimension.append(self._resolve(dimension, keys, rows))

    def label(self, index, key):
        if key == NONE_KEY:
            return NONE_LABEL
        return self.by_dimension[index].get(key, key)

    def _resolve(self, dimension, keys, rows):
        if not keys:
            return {}
        if dimension.is_time:
            return {key: bucket_label(date.fromisoformat(key), dimension.bucket) for key in keys}
        if dimension.kind == "ancestor" or dimension.field == "parent":
            return self._work_item_labels(keys, rows)
        if dimension.kind == "property":
            return self._property_labels(dimension.property, keys)
        model = {
            "state": (State, "name"),
            "type": (IssueType, "name"),
            "project": (Project, "name"),
            "assignee": (User, "display_name"),
            "created_by": (User, "display_name"),
            "label": (Label, "name"),
            "cycle": (Cycle, "name"),
            "module": (Module, "name"),
        }.get(dimension.field)
        if model is None:
            return {key: key.replace("_", " ").capitalize() for key in keys}
        return self._names(model[0], model[1], keys)

    def _names(self, model, attribute, keys):
        return {str(row["id"]): row[attribute] for row in model.objects.filter(id__in=keys).values("id", attribute)}

    def _work_item_labels(self, keys, rows):
        labels = {}
        for row in rows:
            if "sequence_id" in row and str(row["id"]) in keys:
                labels[str(row["id"])] = f"{row['project__identifier']}-{row['sequence_id']} {row['name']}"
        missing = keys - set(labels)
        if missing:
            for item in Issue.objects.filter(id__in=missing, workspace__slug=self.slug).values(
                "id", "name", "sequence_id", "project__identifier"
            ):
                labels[str(item["id"])] = f"{item['project__identifier']}-{item['sequence_id']} {item['name']}"
        return labels

    def _property_labels(self, property_obj, keys):
        if property_obj.property_type == PropertyTypeChoices.OPTION:
            return self._names(IssuePropertyOption, "name", keys)
        if property_obj.property_type == PropertyTypeChoices.RELATION:
            return self._names(User, "display_name", keys)
        if property_obj.property_type == PropertyTypeChoices.BOOLEAN:
            return {"true": "Yes", "false": "No"}
        return {key: key for key in keys}


def _shape(groups, dimensions, metric, labels):
    dimension, series = dimensions
    if dimension.kind == "none":
        return [], {}

    buckets = defaultdict(dict)
    for (key, series_key), accumulator in groups.items():
        buckets[key][series_key] = accumulator

    keys = _ordered_keys(dimension, buckets, metric, series)
    schema = {}
    data = []
    for key in keys:
        row = {"key": key, "name": labels.label(0, key)}
        if series.kind == "none":
            row["count"] = metric.result(buckets[key][None]) if key in buckets else 0
        else:
            merged = _Accumulator()
            for series_key, accumulator in buckets.get(key, {}).items():
                schema.setdefault(series_key, labels.label(1, series_key))
                row[series_key] = metric.result(accumulator)
                merged.merge(accumulator)
            row["count"] = metric.result(merged)
        data.append(row)
    for row in data:
        for series_key in schema:
            row.setdefault(series_key, 0)
    return data, schema


def _ordered_keys(dimension, buckets, metric, series):
    keys = list(buckets)
    if dimension.is_time:
        dated = sorted(key for key in keys if key != NONE_KEY)
        filled = _fill_buckets(dated, dimension.bucket)
        return filled + ([NONE_KEY] if NONE_KEY in keys else [])

    def weight(key):
        total = _Accumulator()
        for accumulator in buckets[key].values():
            total.merge(accumulator)
        return total.count if metric.function == "count" else total.total

    ordered = sorted((key for key in keys if key != NONE_KEY), key=lambda key: (-weight(key), key))
    return ordered + ([NONE_KEY] if NONE_KEY in keys else [])


def _fill_buckets(keys, bucket):
    """Insert the empty buckets between the first and the last one."""
    if len(keys) < 2:
        return keys
    first, last = date.fromisoformat(keys[0]), date.fromisoformat(keys[-1])
    filled = []
    current = first
    while current <= last and len(filled) < MAX_FILLED_BUCKETS:
        filled.append(current.isoformat())
        current = next_bucket(current, bucket)
    if len(filled) >= MAX_FILLED_BUCKETS:
        return keys
    return filled


# ---------------------------------------------------------------------------
# Dates
# ---------------------------------------------------------------------------


def _user_timezone(user):
    try:
        return zoneinfo.ZoneInfo(getattr(user, "user_timezone", None) or "UTC")
    except (zoneinfo.ZoneInfoNotFoundError, ValueError):
        return zoneinfo.ZoneInfo("UTC")


def bucket_start(value, bucket, timezone):
    """The first day of the bucket a date or datetime falls into."""
    if isinstance(value, datetime):
        value = value.astimezone(timezone).date() if value.tzinfo else value.date()
    if bucket == "day":
        return value
    if bucket == "week":
        return value - timedelta(days=value.weekday())
    if bucket == "quarter":
        return value.replace(month=(value.month - 1) // 3 * 3 + 1, day=1)
    if bucket == "year":
        return value.replace(month=1, day=1)
    return value.replace(day=1)


def next_bucket(start, bucket):
    if bucket == "day":
        return start + timedelta(days=1)
    if bucket == "week":
        return start + timedelta(days=7)
    if bucket == "year":
        return start.replace(year=start.year + 1)
    months = 3 if bucket == "quarter" else 1
    month = start.month - 1 + months
    return start.replace(year=start.year + month // 12, month=month % 12 + 1, day=1)


def bucket_label(start, bucket):
    if bucket == "day":
        return start.isoformat()
    if bucket == "week":
        year, week, _ = start.isocalendar()
        return f"W{week:02d} {year}"
    if bucket == "quarter":
        return f"Q{(start.month - 1) // 3 + 1} {start.year}"
    if bucket == "year":
        return str(start.year)
    return start.strftime("%b %Y")
