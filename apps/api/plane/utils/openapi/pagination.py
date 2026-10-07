# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Schema of the wrapper that plane.utils.paginator.BasePaginator.paginate() returns."""

from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

FLAT = "flat"
GROUPED = "grouped"
SUB_GROUPED = "sub_grouped"


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
    items = serializers.ListField(child=serializer() if isinstance(serializer, type) else serializer)
    if grouping == FLAT:
        results, prefix = items, "Paginated"
    elif grouping == GROUPED:
        # Grouping by an m2m field (labels, assignees, modules) can yield a null total.
        group = _group(f"{name}Group", items, nullable_total=True)
        results, prefix = serializers.DictField(child=group), "GroupedPaginated"
    elif grouping == SUB_GROUPED:
        sub_groups = serializers.DictField(child=_group(f"{name}SubGroup", items))
        group = _group(f"{name}SubGroupedGroup", sub_groups)
        results, prefix = serializers.DictField(child=group), "SubGroupedPaginated"
    else:
        raise ValueError(f"Unknown grouping: {grouping}")

    return inline_serializer(
        name=f"{prefix}{name}List",
        fields={
            "grouped_by": serializers.CharField(allow_null=True),
            "sub_grouped_by": serializers.CharField(allow_null=True),
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
