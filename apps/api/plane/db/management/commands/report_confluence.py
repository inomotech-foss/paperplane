# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

from django.core.management.base import BaseCommand, CommandError

from plane.importers.confluence.backup import space_keys
from plane.importers.confluence.report import report_backup

# How many of a space's worst pages to name in the text output.
WORST_PAGES_SHOWN = 5


class Command(BaseCommand):
    help = "Score how well backed-up Confluence spaces convert, worst first."

    def add_arguments(self, parser):
        parser.add_argument("--backup-dir", required=True, help="Directory holding confluence/<SPACE>/")
        parser.add_argument("--space", action="append", help="Limit to a space key; repeatable. Default: all")
        parser.add_argument("--limit", type=int, help="Only score this many pages per space")
        parser.add_argument("--json", dest="json_path", help="Also write the full report as JSON")
        parser.add_argument(
            "--global-page-map",
            action="store_true",
            help="Resolve links against every backed-up space, not only the ones being scored. "
            "Reads the whole backup, so a single-space run scores its links the way a full import would.",
        )

    def handle(self, *args, **options):
        spaces = options["space"] or space_keys(options["backup_dir"])
        if not spaces:
            raise CommandError(f"No backed-up spaces under {options['backup_dir']}/confluence/")

        reports = report_backup(
            options["backup_dir"],
            spaces=spaces,
            limit=options["limit"],
            global_page_map=options["global_page_map"],
        )
        self._print(reports)

        if options["json_path"]:
            with open(options["json_path"], "w") as handle:
                json.dump([self._as_dict(report) for report in reports], handle, indent=2)
            self.stdout.write(f"\nwrote {options['json_path']}")

    def _print(self, reports):
        pages = sum(report.pages for report in reports)
        lossless = sum(report.lossless for report in reports)
        self.stdout.write(f"{len(reports)} spaces, {pages} pages, {lossless} convert with nothing lost\n")

        self.stdout.write(f"{'SPACE':<12} {'PAGES':>6} {'CLEAN':>6} {'FIDELITY':>9}  TOP CAUSES")
        for report in reports:
            causes = ", ".join(f"{name} x{count}" for name, count in report.unsupported_macros.most_common(3))
            missing = self._missing(report)
            self.stdout.write(
                f"{report.key:<12} {report.pages:>6} {report.lossless:>6} {report.fidelity:>8.0%}  "
                f"{'; '.join(part for part in (causes, missing) if part)}"
            )

        for report in reports:
            if not report.worst:
                continue
            self.stdout.write(f"\n{report.key} - worst pages")
            for page in report.worst[:WORST_PAGES_SHOWN]:
                self.stdout.write(f"  {page.loss:>4} {page.title[:60]}")

    @staticmethod
    def _missing(report):
        parts = []
        for label, values in (
            ("unresolved attachments", report.unresolved_attachments),
            ("unresolved links", report.unresolved_pages),
            ("unresolved authors", report.unresolved_users),
        ):
            if values:
                parts.append(f"{label}: {len(values)}")
        if report.dropped_layouts:
            parts.append(f"layouts flattened: {report.dropped_layouts}")
        return ", ".join(parts)

    @staticmethod
    def _as_dict(report):
        return {
            "space": report.key,
            "name": report.name,
            "pages": report.pages,
            "lossless": report.lossless,
            "fidelity": round(report.fidelity, 4),
            "unsupported_macros": dict(report.unsupported_macros),
            "unresolved_attachments": sorted(report.unresolved_attachments),
            "unresolved_pages": sorted(report.unresolved_pages),
            "unresolved_users": sorted(report.unresolved_users),
            "dropped_layouts": report.dropped_layouts,
            "worst_pages": [
                {"id": page.id, "title": page.title, "loss": page.loss} for page in report.worst[:WORST_PAGES_SHOWN]
            ],
        }
