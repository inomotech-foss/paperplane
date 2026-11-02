# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.


class FakeSource:
    """Stands in for PlaneSource: each table is a list of row dicts."""

    def __init__(self, tables=None):
        self.data = tables or {}

    def tables(self):
        return {name: len(rows) for name, rows in self.data.items()}

    def rows(self, table):
        for row in self.data.get(table, []):
            yield dict(row)

    def close(self):
        pass
