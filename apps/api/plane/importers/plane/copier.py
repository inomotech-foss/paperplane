# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from itertools import islice

from psycopg import sql

from .tables import plan_columns

BATCH_SIZE = 500


class MissingTableError(Exception):
    """The target schema has no table the importer means to fill."""


def target_columns(cursor, table):
    cursor.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = %s",
        [table],
    )
    return {name for (name,) in cursor.fetchall()}


def copy_table(source, spec, cursor):
    """Upsert every source row of ``spec.name`` into the target, keyed on id."""
    targets = target_columns(cursor, spec.name)
    if not targets:
        raise MissingTableError(spec.name)

    select = plan_columns(source.columns(spec.name), targets, spec)
    if not select:
        return 0
    columns = [item.rsplit(' AS "', 1)[1].rstrip('"') for item in select]

    updates = [column for column in columns if column != "id"]
    statement = sql.SQL("INSERT INTO {table} ({columns}) VALUES ({values}) ON CONFLICT (id) DO {action}").format(
        table=sql.Identifier(spec.name),
        columns=sql.SQL(", ").join(map(sql.Identifier, columns)),
        values=sql.SQL(", ").join(sql.Placeholder() * len(columns)),
        action=sql.SQL("UPDATE SET {}").format(
            sql.SQL(", ").join(sql.SQL("{0} = EXCLUDED.{0}").format(sql.Identifier(c)) for c in updates)
        )
        if updates
        else sql.SQL("NOTHING"),
    )
    query = statement.as_string(cursor.connection)

    written = 0
    rows = source.rows(spec.name, select)
    while batch := list(islice(rows, BATCH_SIZE)):
        cursor.executemany(query, batch)
        written += len(batch)
    return written
