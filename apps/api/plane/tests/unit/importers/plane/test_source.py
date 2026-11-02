# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

import pytest
from django.db import connection
from psycopg.conninfo import make_conninfo

from plane.importers.plane.source import PlaneSource

SCHEMA = "plane_source_test"


def source_dsn():
    settings = connection.settings_dict
    return make_conninfo(
        dbname=settings["NAME"],
        user=settings["USER"],
        password=settings["PASSWORD"],
        host=settings["HOST"],
        port=settings["PORT"] or 5432,
    )


@pytest.fixture
def schema(transactional_db):
    """A committed schema, so the source's own connection can see it."""
    with connection.cursor() as cursor:
        cursor.execute(f"CREATE SCHEMA {SCHEMA}")
    try:
        yield SCHEMA
    finally:
        with connection.cursor() as cursor:
            cursor.execute(f"DROP SCHEMA {SCHEMA} CASCADE")


@pytest.mark.django_db
def test_source_reads_in_one_read_only_snapshot():
    source = PlaneSource(source_dsn())
    try:
        read_only = source.connection.execute("SHOW transaction_read_only").fetchone()[0]
        isolation = source.connection.execute("SHOW transaction_isolation").fetchone()[0]
    finally:
        source.close()
    assert (read_only, isolation) == ("on", "repeatable read")


def test_rows_are_dicts(schema):
    thing = uuid.uuid4()
    with connection.cursor() as cursor:
        cursor.execute(f"CREATE TABLE {schema}.things (id uuid, name text)")
        cursor.execute(f"INSERT INTO {schema}.things VALUES (%s, 'a')", [thing])
    source = PlaneSource(source_dsn(), schema=schema)
    try:
        assert list(source.rows("things")) == [{"id": thing, "name": "a"}]
    finally:
        source.close()


def test_missing_table_yields_nothing(schema):
    source = PlaneSource(source_dsn(), schema=schema)
    try:
        assert list(source.rows("nope")) == []
    finally:
        source.close()


def test_tables_counts_every_table(schema):
    with connection.cursor() as cursor:
        cursor.execute(f"CREATE TABLE {schema}.things (id uuid)")
        cursor.execute(f"INSERT INTO {schema}.things VALUES (%s)", [uuid.uuid4()])
        cursor.execute(f"CREATE TABLE {schema}.empty (id uuid)")
    source = PlaneSource(source_dsn(), schema=schema)
    try:
        assert source.tables() == {"things": 1, "empty": 0}
    finally:
        source.close()
