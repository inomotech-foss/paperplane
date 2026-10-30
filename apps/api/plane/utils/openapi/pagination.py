# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Schema of the wrapper that plane.utils.paginator.BasePaginator.paginate() returns."""

from drf_spectacular.drainage import set_override
from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema_field, inline_serializer
from rest_framework import serializers

FLAT = "flat"
GROUPED = "grouped"
SUB_GROUPED = "sub_grouped"


# A null-only type would be dropped by openapi-fetch, so this is a string that cannot hold a value.
@extend_schema_field({"type": "string", "nullable": True, "maxLength": 0})
class _NullField(serializers.Field):
    """Always null, so the flat, grouped and sub-grouped variants stay distinct."""


# One instance per component name: drf-spectacular warns about two inline serializers sharing a name.
_BUILT = {}


def _once(name, build):
    if name not in _BUILT:
        _BUILT[name] = build()
    return _BUILT[name]


def _item_name(serializer):
    cls = serializer if isinstance(serializer, type) else type(serializer)
    return cls.__name__.removesuffix("Serializer")


def _group(name, results, nullable_total=False):
    return inline_serializer(
        name=name,
        fields={"results": results, "total_results": serializers.IntegerField(allow_null=nullable_total)},
    )


def paginated_response(serializer, grouping=FLAT, name=None):
    """Return a serializer that describes paginate() output with `serializer` items.

    grouping: FLAT for a list, GROUPED for group_by, SUB_GROUPED for group_by plus sub_group_by.
    name: component name prefix, defaults to the serializer name without "Serializer".
    """
    name = name or _item_name(serializer)
    prefix = {FLAT: "Paginated", GROUPED: "GroupedPaginated", SUB_GROUPED: "SubGroupedPaginated"}.get(grouping)
    if prefix is None:
        raise ValueError(f"Unknown grouping: {grouping}")
    return _once(f"{prefix}{name}List", lambda: _build_paginated(serializer, grouping, name, prefix))


def _build_paginated(serializer, grouping, name, prefix):
    items = serializers.ListField(child=serializer() if isinstance(serializer, type) else serializer)
    if grouping == FLAT:
        results = items
    elif grouping == GROUPED:
        # Grouping by an m2m field (labels, assignees, modules) can yield a null total.
        group = _group(f"{name}Group", items, nullable_total=True)
        results = serializers.DictField(child=group)
    else:
        sub_groups = serializers.DictField(child=_group(f"{name}SubGroup", items))
        group = _group(f"{name}SubGroupedGroup", sub_groups)
        results = serializers.DictField(child=group)

    grouped_by = _NullField() if grouping == FLAT else serializers.CharField(min_length=1)
    sub_grouped_by = serializers.CharField(min_length=1) if grouping == SUB_GROUPED else _NullField()
    # A viewset's list action would otherwise wrap the wrapper in an array.
    return set_override(_paginated(f"{prefix}{name}List", results, grouped_by, sub_grouped_by), "many", False)


def _paginated(name, results, grouped_by, sub_grouped_by):
    return inline_serializer(
        name=name,
        fields={
            "grouped_by": grouped_by,
            "sub_grouped_by": sub_grouped_by,
            "total_count": serializers.IntegerField(),
            "next_cursor": serializers.CharField(),
            "prev_cursor": serializers.CharField(),
            "next_page_results": serializers.BooleanField(),
            "prev_page_results": serializers.BooleanField(),
            "count": serializers.IntegerField(),
            "total_pages": serializers.IntegerField(),
            "total_results": serializers.IntegerField(),
            "extra_stats": serializers.JSONField(allow_null=True),
            "results": results,
        },
    )


def paginated_union(serializer, name=None):
    """paginate() output that is flat, grouped or sub-grouped depending on group_by and sub_group_by."""
    name = name or _item_name(serializer)
    return _once(f"{name}ListResponse", lambda: _build_union(serializer, name))


def _build_union(serializer, name):
    union = PolymorphicProxySerializer(
        component_name=f"{name}ListResponse",
        serializers=[paginated_response(serializer, grouping, name) for grouping in (FLAT, GROUPED, SUB_GROUPED)],
        resource_type_field_name=None,
        many=False,
        help_text="Grouped when group_by is given, sub-grouped when sub_group_by is given too",
    )
    return set_override(union, "many", False)


def cursor_paginated_response(serializer, name=None):
    """Schema of what plane.utils.global_paginator.paginate() returns."""
    name = name or _item_name(serializer)
    return _once(f"CursorPaginated{name}List", lambda: _build_cursor(serializer, name))


def _build_cursor(serializer, name):
    paginated = inline_serializer(
        name=f"CursorPaginated{name}List",
        fields={
            "prev_cursor": serializers.CharField(),
            "cursor": serializers.CharField(),
            "next_cursor": serializers.CharField(allow_null=True),
            "prev_page_results": serializers.BooleanField(),
            "next_page_results": serializers.BooleanField(),
            "page_count": serializers.IntegerField(),
            "total_results": serializers.IntegerField(),
            "total_pages": serializers.IntegerField(),
            "results": serializers.ListField(child=serializer() if isinstance(serializer, type) else serializer),
        },
    )
    return set_override(paginated, "many", False)


def list_or_paginated(serializer, name=None):
    """A plain list, or paginate() output when the client sends both cursor and per_page."""
    name = name or _item_name(serializer)
    return _once(f"{name}ListOrPage", lambda: _build_list_or_page(serializer, name))


def _build_list_or_page(serializer, name):
    child = serializer() if isinstance(serializer, type) else serializer
    union = PolymorphicProxySerializer(
        component_name=f"{name}ListOrPage",
        serializers=[serializers.ListSerializer(child=child), paginated_response(serializer, FLAT, name)],
        resource_type_field_name=None,
        many=False,
        help_text="Paginated when both cursor and per_page are given",
    )
    return set_override(union, "many", False)
