# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.core.management.base import BaseCommand, CommandError

from plane.importers.plane.copier import MissingTableError
from plane.importers.plane.loader import ImportRefused, OrphanRowsError, PlaneImporter
from plane.importers.plane.source import PlaneSource


class Command(BaseCommand):
    help = "Copy a whole Plane database into this one, keeping ids, authors, dates and history."

    def add_arguments(self, parser):
        parser.add_argument("--source-dsn", required=True, help="postgresql:// URL of the restored Plane database")
        parser.add_argument("--web-url", required=True, help="Public URL of this instance, used in page links")
        parser.add_argument("--dry-run", action="store_true", help="Roll back instead of committing")
        parser.add_argument("--allow-existing", action="store_true", help="Load even if workspaces already exist")

    def handle(self, *args, **options):
        source = PlaneSource(options["source_dsn"])
        try:
            report = PlaneImporter(source, web_url=options["web_url"], allow_existing=options["allow_existing"]).run(
                dry_run=options["dry_run"]
            )
        except (MissingTableError, ImportRefused) as error:
            raise CommandError(str(error))
        except OrphanRowsError as error:
            raise CommandError(f"rows point at missing parents, nothing committed: {error}")
        finally:
            source.close()

        for table, rows in report.copied.items():
            self.stdout.write(f"{table:<32} {rows}")
        self.stdout.write(f"typed        {report.typed} work items given a default type")
        self.stdout.write(f"page links   {report.page_links} work item to page links")
        for table, reason in report.skipped.items():
            self.stdout.write(self.style.WARNING(f"skipped      {table}: {reason}"))
        if report.dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN: rolled back"))
