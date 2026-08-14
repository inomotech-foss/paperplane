# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Compilers for the structured work item query parameters advertised by plane-sdk.

`filters` (the JSON AST) is compiled here. `pql`, the human-readable syntax,
parses into that same AST, so both parameters share one compiler.
"""

from plane.utils.pql.fields import FILTER_FIELDS, UNSUPPORTED_FIELDS
from plane.utils.pql.filters import (
    MAX_FILTER_DEPTH,
    CompiledFilters,
    CustomPropertyFilter,
    FilterCompileError,
    compile_filters,
)
from plane.utils.pql.lexer import PQLSyntaxError
from plane.utils.pql.parser import (
    CHILD_OF_PLACEHOLDER,
    CURRENT_USER_PLACEHOLDER,
    NOW_PLACEHOLDER,
    parse_pql,
)
from plane.utils.pql.resolve import (
    WorkItemFilterError,
    apply_work_item_filters,
    compile_work_item_filters,
    resolve_group_by,
)

__all__ = [
    "CHILD_OF_PLACEHOLDER",
    "CURRENT_USER_PLACEHOLDER",
    "FILTER_FIELDS",
    "MAX_FILTER_DEPTH",
    "NOW_PLACEHOLDER",
    "UNSUPPORTED_FIELDS",
    "CompiledFilters",
    "CustomPropertyFilter",
    "FilterCompileError",
    "PQLSyntaxError",
    "WorkItemFilterError",
    "apply_work_item_filters",
    "compile_filters",
    "compile_work_item_filters",
    "parse_pql",
    "resolve_group_by",
]
