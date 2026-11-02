# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.core.management.base import BaseCommand, CommandError

from plane.importers.plane.loader import ImportConflict, ImportRefused, PlaneImporter
from plane.importers.plane.source import PlaneSource


class Command(BaseCommand):
    help = "Import a Plane database into this instance, keeping ids, authors, dates and history."

    def add_arguments(self, parser):
        parser.add_argument("--source-dsn", required=True, help="postgresql:// URL of the Plane database")
        parser.add_argument("--source-schema", default="public", help="Schema holding the Plane tables")
        parser.add_argument("--web-url", required=True, help="Public URL of this instance, used in page links")
        parser.add_argument(
            "--workspace", action="append", metavar="SLUG", help="Import only this workspace; repeatable"
        )
        parser.add_argument("--dry-run", action="store_true", help="Roll back instead of committing")
        parser.add_argument(
            "--allow-existing", action="store_true", help="Import again into workspaces an earlier run created"
        )

    def handle(self, *args, **options):
        source = PlaneSource(options["source_dsn"], schema=options["source_schema"])
        try:
            report = PlaneImporter(
                source,
                web_url=options["web_url"],
                workspaces=options["workspace"],
                allow_existing=options["allow_existing"],
            ).run(dry_run=options["dry_run"])
        except ImportRefused as error:
            raise CommandError(str(error))
        except ImportConflict as error:
            raise CommandError(f"the target refused a row, nothing committed: {error}")
        finally:
            source.close()
        self._report(report)

    def _report(self, report):
        for table, rows in report.written.items():
            self.stdout.write(f"{table:<34} {rows}")
        self.stdout.write(f"users        {report.matched_users} matched to existing accounts by email")
        self.stdout.write(f"types        {report.typed} work items given their project's default type")
        self.stdout.write(f"projects     {report.typed_projects} projects given the Task type")
        self.stdout.write(f"type icons   {report.type_icons} converted to Material Symbols")
        self.stdout.write(f"page links   {report.page_links} work item to page links")
        if report.file_objects:
            self.stdout.write(
                f"files        {report.file_objects} rows point at stored objects; copy the bucket with keys kept"
            )

        warn = self.style.WARNING
        for old, new in report.renamed_users:
            self.stdout.write(warn(f"renamed      username {old} was taken, imported as {new}"))
        if report.relations_downgraded:
            self.stdout.write(
                warn(f"relations    {report.relations_downgraded} of a type PaperPlane lacks became relates_to")
            )
        for table, reasons in sorted(report.dropped.items()):
            for reason, rows in sorted(reasons.items()):
                self.stdout.write(warn(f"left out     {table}: {rows} rows, {reason}"))
        for reference, rows in sorted(report.nulled.items()):
            self.stdout.write(warn(f"cleared      {reference}: {rows} references to rows not imported"))
        for table, (rows, reason) in sorted(report.skipped.items()):
            self.stdout.write(warn(f"skipped      {table}: {rows} rows, {reason}"))
        for table, rows in sorted(report.unknown.items()):
            self.stdout.write(warn(f"unknown      {table}: {rows} rows, not imported"))
        if report.dry_run:
            self.stdout.write(warn("dry run, rolled back"))
