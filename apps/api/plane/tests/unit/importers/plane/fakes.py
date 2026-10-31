# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import re

_ALIAS = re.compile(r'^(.*) AS "([^"]+)"$')
_LITERALS = {"true": True, "false": False}


def _value(row, expression, alias):
    """Columns come from the row; quoted strings and booleans are evaluated; other SQL is ignored."""
    if alias in row:
        return row[alias]
    if expression.startswith("'") and expression.endswith("'"):
        return expression[1:-1]
    return _LITERALS.get(expression)


class FakeSource:
    """Stands in for PlaneSource: tables are lists of dicts, only literal expressions are evaluated."""

    def __init__(self, tables=None, types=None):
        self.tables = tables or {}
        self.types = types or {}

    def columns(self, table):
        rows = self.tables.get(table, [])
        names = set().union(*(row.keys() for row in rows)) if rows else set()
        return {name: self.types.get(name, "text") for name in names}

    def rows(self, table, select):
        parsed = [_ALIAS.search(item).groups() for item in select]
        for row in self.tables.get(table, []):
            yield tuple(_value(row, expression, alias) for expression, alias in parsed)

    def count(self, table):
        return len(self.tables.get(table, []))

    def tables_with_rows(self):
        return {name: len(rows) for name, rows in self.tables.items() if rows}
