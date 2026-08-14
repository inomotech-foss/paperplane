# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Compilers for the structured work item query parameters advertised by plane-sdk.

`filters` (the JSON AST) is compiled here. `pql`, the human-readable syntax,
compiles into the same AST in a follow-up change.
"""

from plane.utils.pql.fields import FILTER_FIELDS, UNSUPPORTED_FIELDS
from plane.utils.pql.filters import (
    MAX_FILTER_DEPTH,
    CompiledFilters,
    CustomPropertyFilter,
    FilterCompileError,
    compile_filters,
)

__all__ = [
    "FILTER_FIELDS",
    "MAX_FILTER_DEPTH",
    "UNSUPPORTED_FIELDS",
    "CompiledFilters",
    "CustomPropertyFilter",
    "FilterCompileError",
    "compile_filters",
]
