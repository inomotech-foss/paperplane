# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

from django.core.management.base import BaseCommand, CommandError

from plane.importers.jira.backup import project_keys
from plane.importers.jira.report import report_backup

# How many of a project's worst issues to name in the text output.
WORST_ISSUES_SHOWN = 5

# How many distinct causes to name per project.
TOP_CAUSES_SHOWN = 3

BUCKETS = ("converted", "downgraded", "chrome", "lost")


def _buckets(tally):
    return {name: dict(getattr(tally, name)) for name in BUCKETS}


class Command(BaseCommand):
    help = "Score how well backed-up Jira projects convert, worst first."

    def add_arguments(self, parser):
        parser.add_argument("--backup-dir", required=True, help="Directory holding jira/<PROJECT_KEY>/")
        parser.add_argument("--project", action="append", help="Limit to a project key; repeatable. Default: all")
        parser.add_argument("--limit", type=int, help="Only score this many issues per project")
        parser.add_argument("--json", dest="json_path", help="Also write the full report as JSON")

    def handle(self, *args, **options):
        projects = options["project"] or project_keys(options["backup_dir"])
        if not projects:
            raise CommandError(f"No backed-up projects under {options['backup_dir']}/jira/")

        reports = report_backup(options["backup_dir"], projects=projects, limit=options["limit"])
        self._print(reports)

        if options["json_path"]:
            with open(options["json_path"], "w") as handle:
                json.dump([self._as_dict(report) for report in reports], handle, indent=2)
            self.stdout.write(f"\nwrote {options['json_path']}")

    def _print(self, reports):
        issues = sum(report.issues for report in reports)
        documents = sum(report.documents for report in reports)
        lossless = sum(report.lossless for report in reports)
        totals = self._totals(reports)

        self.stdout.write(f"{len(reports)} projects, {issues} issues, {documents} documents")
        self.stdout.write(f"{lossless} issues convert with nothing lost")
        self.stdout.write(
            f"{totals['converted']} constructs converted, {totals['downgraded']} downgraded, "
            f"{totals['chrome']} authoring affordances dropped, {totals['lost']} lost\n"
        )

        self.stdout.write(f"{'PROJECT':<12} {'ISSUES':>6} {'CLEAN':>6} {'FIDELITY':>9}  TOP CAUSES")
        for report in reports:
            self.stdout.write(
                f"{report.key:<12} {report.issues:>6} {report.lossless:>6} {report.fidelity:>8.0%}  "
                f"{self._causes(report)}"
            )

        for report in reports:
            if not report.worst:
                continue
            self.stdout.write(f"\n{report.key} - worst issues")
            for issue in report.worst[:WORST_ISSUES_SHOWN]:
                self.stdout.write(f"  {issue.loss:>4} {issue.key} {issue.summary[:60]}")

    @staticmethod
    def _totals(reports):
        return {
            name: sum(
                sum(getattr(report.nodes, name).values()) + sum(getattr(report.marks, name).values())
                for report in reports
            )
            for name in BUCKETS
        }

    @staticmethod
    def _causes(report):
        lost = report.nodes.lost + report.marks.lost
        parts = [f"{name} x{count}" for name, count in lost.most_common(TOP_CAUSES_SHOWN)]
        if report.unresolved_attachments:
            parts.append(f"unresolved attachments: {len(report.unresolved_attachments)}")
        if report.unresolved_users:
            parts.append(f"unresolved authors: {len(report.unresolved_users)}")
        return ", ".join(parts)

    @staticmethod
    def _as_dict(report):
        return {
            "project": report.key,
            "name": report.name,
            "issues": report.issues,
            "documents": report.documents,
            "lossless": report.lossless,
            "fidelity": round(report.fidelity, 4),
            "nodes": _buckets(report.nodes),
            "marks": _buckets(report.marks),
            "unresolved_attachments": sorted(report.unresolved_attachments),
            "unresolved_users": sorted(report.unresolved_users),
            "worst_issues": [
                {"key": issue.key, "summary": issue.summary, "loss": issue.loss}
                for issue in report.worst[:WORST_ISSUES_SHOWN]
            ],
        }
