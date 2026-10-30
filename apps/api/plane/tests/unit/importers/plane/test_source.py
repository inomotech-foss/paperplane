# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.db import connection
from psycopg.conninfo import make_conninfo

from plane.importers.plane.source import PlaneSource


@pytest.mark.django_db
def test_source_reads_in_one_read_only_snapshot():
    settings = connection.settings_dict
    dsn = make_conninfo(
        dbname=settings["NAME"],
        user=settings["USER"],
        password=settings["PASSWORD"],
        host=settings["HOST"],
        port=settings["PORT"] or 5432,
    )
    source = PlaneSource(dsn)
    try:
        read_only = source.connection.execute("SHOW transaction_read_only").fetchone()[0]
        isolation = source.connection.execute("SHOW transaction_isolation").fetchone()[0]
    finally:
        source.close()
    assert (read_only, isolation) == ("on", "repeatable read")
