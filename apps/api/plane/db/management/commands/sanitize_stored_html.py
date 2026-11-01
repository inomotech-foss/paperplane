# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Sanitize user HTML that was stored before its write path sanitized it.

Rows are written with bulk_update, so updated_at, versions, activity and webhooks are not touched.
"""

from dataclasses import dataclass

from django.core.management.base import BaseCommand, CommandError
from django.db import models

from plane.db.models import Description, DraftIssue, Issue, IssueComment, IssueDescriptionVersion, Page
from plane.utils.content_validator import validate_html_content
from plane.utils.html_processor import strip_tags


@dataclass(frozen=True)
class Target:
    model: type[models.Model]
    html: str
    stripped: str
    # The value the model's save() stores as stripped text for empty HTML.
    empty_stripped: str | None = None
    # A comment mirrors its HTML into a Description row, which has to follow it.
    mirror: str | None = None

    def stripped_text(self, html):
        return strip_tags(html) if html else self.empty_stripped


TARGETS = {
    "page": Target(Page, "description_html", "description_stripped"),
    "issue": Target(Issue, "description_html", "description_stripped"),
    "issue_description_version": Target(IssueDescriptionVersion, "description_html", "description_stripped"),
    "issue_comment": Target(
        IssueComment, "comment_html", "comment_stripped", empty_stripped="", mirror="description_id"
    ),
    "draft_issue": Target(DraftIssue, "description_html", "description_stripped"),
}


class Command(BaseCommand):
    help = "Sanitize stored user HTML (dry run unless --apply is given)"

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument("--dry-run", action="store_true", help="Report the rows that would change (default)")
        mode.add_argument("--apply", action="store_true", help="Write the sanitized HTML")
        parser.add_argument(
            "--model",
            action="append",
            choices=sorted(TARGETS),
            help="Model to sanitize, can be repeated (default: all)",
        )
        parser.add_argument("--batch-size", type=int, default=500, help="Rows read and written per batch")

    def handle(self, *args, **options):
        batch_size = options["batch_size"]
        if batch_size < 1:
            raise CommandError("--batch-size must be at least 1")

        apply = options["apply"]
        totals = [0, 0, 0]
        for name in options["model"] or TARGETS:
            counts = self._sanitize(name, TARGETS[name], apply, batch_size)
            totals = [total + count for total, count in zip(totals, counts)]
        self.stdout.write(_summary("done", *totals, apply))

    def _sanitize(self, name, target, apply, batch_size):
        fields = ["id", target.html] + ([target.mirror] if target.mirror else [])
        rows = target.model.all_objects.only(*fields).order_by("id")
        scanned = changed = failed = 0
        pending = []

        for row in rows.iterator(chunk_size=batch_size):
            scanned += 1
            html = getattr(row, target.html)
            if html:
                is_valid, error, clean = validate_html_content(html)
                if not is_valid:
                    failed += 1
                    self.stderr.write(f"rejected {name} {row.id}: {error}")
                elif clean != html:
                    changed += 1
                    self.stdout.write(f"{'changed' if apply else 'would change'} {name} {row.id}")
                    pending.append((row, clean))

            if len(pending) >= batch_size:
                _write(target, pending, apply)
                pending = []
            if scanned % batch_size == 0:
                self.stdout.write(_summary(name, scanned, changed, failed, apply))

        _write(target, pending, apply)
        self.stdout.write(_summary(name, scanned, changed, failed, apply))
        return [scanned, changed, failed]


def _summary(label, scanned, changed, failed, apply):
    return f"{label}: scanned {scanned}, {'changed' if apply else 'would change'} {changed}, failed {failed}"


def _write(target, pending, apply):
    if not apply or not pending:
        return
    target.model.all_objects.bulk_update(
        [
            target.model(id=row.id, **{target.html: clean, target.stripped: target.stripped_text(clean)})
            for row, clean in pending
        ],
        [target.html, target.stripped],
    )
    if target.mirror:
        mirrors = [
            Description(
                id=getattr(row, target.mirror),
                description_html=clean,
                description_stripped=strip_tags(clean) if clean else None,
            )
            for row, clean in pending
            if getattr(row, target.mirror)
        ]
        Description.all_objects.bulk_update(mirrors, ["description_html", "description_stripped"])
