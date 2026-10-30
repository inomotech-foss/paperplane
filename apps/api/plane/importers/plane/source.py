# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import psycopg
from psycopg import sql


class PlaneSource:
    """A read-only connection to a restored Plane database."""

    def __init__(self, dsn):
        self.connection = psycopg.connect(dsn, autocommit=False)
        self.connection.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")

    def columns(self, table):
        rows = self.connection.execute(
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = %s",
            (table,),
        )
        return dict(rows.fetchall())

    def rows(self, table, select):
        query = sql.SQL("SELECT {} FROM {}").format(
            sql.SQL(", ").join(sql.SQL(item) for item in select), sql.Identifier(table)
        )
        with self.connection.cursor(name=f"read_{table}") as cursor:
            cursor.itersize = 500
            cursor.execute(query)
            yield from cursor

    def count(self, table):
        query = sql.SQL("SELECT count(*) FROM {}").format(sql.Identifier(table))
        return self.connection.execute(query).fetchone()[0]

    def tables_with_rows(self):
        names = self.connection.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1"
        ).fetchall()
        counts = {name: self.count(name) for (name,) in names}
        return {name: count for name, count in counts.items() if count}

    def close(self):
        self.connection.close()
