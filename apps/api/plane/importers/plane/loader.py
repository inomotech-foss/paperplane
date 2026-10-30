# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from dataclasses import dataclass, field
from io import StringIO

from django.core.management import call_command
from django.db import connection, transaction

from .copier import MissingTableError, copy_table, target_columns
from .fixups import assign_default_types, link_work_item_pages
from .tables import SKIPPED, TABLES


class ImportRefused(Exception):
    """The target already holds data and the caller did not allow that."""


class OrphanRowsError(Exception):
    def __init__(self, orphans):
        self.orphans = orphans
        super().__init__(", ".join(f"{key}: {count}" for key, count in sorted(orphans.items())))


@dataclass
class ImportReport:
    copied: dict = field(default_factory=dict)
    typed: int = 0
    page_links: int = 0
    skipped: dict = field(default_factory=dict)
    orphans: dict = field(default_factory=dict)
    dry_run: bool = False


_FOREIGN_KEYS = """
SELECT c.conrelid::regclass::text, a.attname, c.confrelid::regclass::text, af.attname
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = c.confkey[1]
WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1 AND c.connamespace = 'public'::regnamespace
"""


def orphan_report(cursor):
    """Rows whose single-column foreign key points at a missing parent."""
    cursor.execute(_FOREIGN_KEYS)
    orphans = {}
    for table, column, parent, parent_column in cursor.fetchall():
        cursor.execute(
            f'SELECT count(*) FROM {table} c WHERE c."{column}" IS NOT NULL AND NOT EXISTS '
            f'(SELECT 1 FROM {parent} p WHERE p."{parent_column}" = c."{column}")'
        )
        count = cursor.fetchone()[0]
        if count:
            orphans[f"{table}.{column}"] = count
    return orphans


class PlaneImporter:
    """Copy a Plane database into this PaperPlane database, ids and all."""

    def __init__(self, source, web_url, allow_existing=False):
        self.source = source
        self.web_url = web_url
        self.allow_existing = allow_existing

    def run(self, dry_run=False):
        report = ImportReport(dry_run=dry_run)
        with connection.cursor() as cursor:
            self._preflight(cursor)
            with transaction.atomic():
                # Parents and children load in table order, not FK order, so FK
                # triggers are off for the copy and the orphan check stands in.
                cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")
                cursor.execute("ALTER TABLE issues ALTER COLUMN type_id DROP NOT NULL")
                cursor.execute("SET LOCAL session_replication_role = replica")
                for spec in TABLES:
                    report.copied[spec.name] = copy_table(self.source, spec, cursor)
                report.typed = assign_default_types(self.source, cursor)
                report.page_links = link_work_item_pages(self.source, cursor, self.web_url)
                cursor.execute("SET LOCAL session_replication_role = origin")
                cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")
                cursor.execute("ALTER TABLE issues ALTER COLUMN type_id SET NOT NULL")

                report.orphans = orphan_report(cursor)
                if report.orphans:
                    raise OrphanRowsError(report.orphans)
                call_command("recompute_derived_properties", stdout=StringIO())
                if dry_run:
                    transaction.set_rollback(True)

        present = self.source.tables_with_rows()
        report.skipped = {name: reason for name, reason in SKIPPED.items() if name in present}
        return report

    def _preflight(self, cursor):
        missing = [spec.name for spec in TABLES if not target_columns(cursor, spec.name)]
        if missing:
            raise MissingTableError(", ".join(missing))
        cursor.execute("SELECT EXISTS (SELECT 1 FROM workspaces)")
        if cursor.fetchone()[0] and not self.allow_existing:
            raise ImportRefused("the target already has workspaces; pass --allow-existing to load anyway")
