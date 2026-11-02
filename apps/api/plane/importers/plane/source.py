# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import psycopg
from psycopg import sql
from psycopg.rows import dict_row


class PlaneSource:
    """A read-only connection to a restored Plane database.

    Every read runs in one REPEATABLE READ transaction, so counts and rows come
    from a single snapshot even if the source is live. Rows come back as dicts
    keyed by column name: the importer asks for the columns it knows and lets
    the rest go, so the two schemas never have to match.
    """

    def __init__(self, dsn, schema="public"):
        self.schema = schema
        self.connection = psycopg.connect(dsn, autocommit=False)
        self.connection.read_only = True
        self.connection.isolation_level = psycopg.IsolationLevel.REPEATABLE_READ
        self._tables = None

    def tables(self):
        """Every base table in the schema with its row count, empty ones included."""
        if self._tables is None:
            names = self.connection.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = %s AND table_type = 'BASE TABLE' ORDER BY 1",
                (self.schema,),
            ).fetchall()
            self._tables = {name: self._count(name) for (name,) in names}
        return self._tables

    def rows(self, table):
        """Each row of `table` as a dict; nothing when the source has no such table."""
        if table not in self.tables():
            return
        query = sql.SQL("SELECT * FROM {}.{}").format(sql.Identifier(self.schema), sql.Identifier(table))
        with self.connection.cursor(name=f"read_{table}", row_factory=dict_row) as cursor:
            cursor.itersize = 500
            cursor.execute(query)
            yield from cursor

    def _count(self, table):
        query = sql.SQL("SELECT count(*) FROM {}.{}").format(sql.Identifier(self.schema), sql.Identifier(table))
        return self.connection.execute(query).fetchone()[0]

    def close(self):
        self.connection.close()
