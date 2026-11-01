# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Sanitize user HTML that was stored before its write path sanitized it.

Each row is written with a queryset update filtered on its old value, so updated_at, versions,
activity and webhooks are not touched, and a row edited during the run is skipped, not overwritten.
"""

from dataclasses import dataclass

from django.core.management.base import BaseCommand, CommandError
from django.db import models, transaction

from plane.automation.sanitize import HTML_TEMPLATE_FIELDS, template_field
from plane.db.models import (
    AutomationAction,
    Description,
    DescriptionVersion,
    DraftIssue,
    Issue,
    IssueComment,
    IssueDescriptionVersion,
    Page,
    PageVersion,
)
from plane.utils.content_validator import validate_html_content
from plane.utils.html_processor import strip_tags


def _stripped(html, empty):
    return strip_tags(html) if html else empty


@dataclass(frozen=True)
class HtmlField:
    model: type[models.Model]
    html: str = "description_html"
    stripped: str = "description_stripped"
    # The value the model's save() stores as stripped text for empty HTML.
    empty_stripped: str | None = None
    # A comment mirrors its HTML into a Description row, which has to follow it.
    mirror: str | None = None

    def rows(self):
        fields = ["id", self.html] + ([self.mirror] if self.mirror else [])
        return self.model.all_objects.only(*fields).order_by("id")

    def html_of(self, row):
        return getattr(row, self.html)

    def write(self, row, clean):
        """Writes one row unless it changed since it was read. Returns whether it was written."""
        values = {self.html: clean, self.stripped: _stripped(clean, self.empty_stripped)}
        written = self.model.all_objects.filter(pk=row.pk, **{self.html: self.html_of(row)}).update(**values)
        mirror_id = getattr(row, self.mirror) if self.mirror else None
        if written and mirror_id:
            Description.all_objects.filter(pk=mirror_id).update(
                description_html=clean, description_stripped=_stripped(clean, "")
            )
        return bool(written)


class AutomationTemplate:
    """The HTML template inside an automation action's config."""

    def rows(self):
        actions = AutomationAction.all_objects.filter(action_type__in=list(HTML_TEMPLATE_FIELDS))
        return actions.only("id", "action_type", "config").order_by("id")

    def html_of(self, row):
        field = template_field(row.action_type, row.config)
        return row.config[field] if field else None

    def write(self, row, clean):
        config = {**row.config, template_field(row.action_type, row.config): clean}
        return bool(AutomationAction.all_objects.filter(pk=row.pk, config=row.config).update(config=config))


TARGETS = {
    "page": HtmlField(Page),
    "page_version": HtmlField(PageVersion),
    "issue": HtmlField(Issue),
    "issue_description_version": HtmlField(IssueDescriptionVersion),
    "issue_comment": HtmlField(
        IssueComment, html="comment_html", stripped="comment_stripped", empty_stripped="", mirror="description_id"
    ),
    "description": HtmlField(Description),
    "description_version": HtmlField(DescriptionVersion),
    "draft_issue": HtmlField(DraftIssue),
    "automation": AutomationTemplate(),
}


@dataclass
class Counts:
    scanned: int = 0
    changed: int = 0
    skipped: int = 0
    failed: int = 0

    def add(self, other):
        self.scanned += other.scanned
        self.changed += other.changed
        self.skipped += other.skipped
        self.failed += other.failed

    def summary(self, label, apply):
        verb = "changed" if apply else "would change"
        return (
            f"{label}: scanned {self.scanned}, {verb} {self.changed}, "
            f"skipped (changed during run) {self.skipped}, failed {self.failed}"
        )


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
        totals = Counts()
        for name in options["model"] or TARGETS:
            totals.add(self._sanitize(name, TARGETS[name], apply, batch_size))
        self.stdout.write(totals.summary("done", apply))

    def _sanitize(self, name, target, apply, batch_size):
        counts = Counts()
        pending = []

        for row in target.rows().iterator(chunk_size=batch_size):
            counts.scanned += 1
            html = target.html_of(row)
            if html:
                is_valid, error, clean = validate_html_content(html)
                if not is_valid:
                    counts.failed += 1
                    self.stderr.write(f"rejected {name} {row.id}: {error}")
                elif clean != html:
                    pending.append((row, clean))

            if len(pending) >= batch_size:
                self._flush(name, target, pending, apply, counts)
                pending = []
            if counts.scanned % batch_size == 0:
                self.stdout.write(counts.summary(name, apply))

        self._flush(name, target, pending, apply, counts)
        self.stdout.write(counts.summary(name, apply))
        return counts

    def _flush(self, name, target, pending, apply, counts):
        if not apply:
            for row, _clean in pending:
                counts.changed += 1
                self.stdout.write(f"would change {name} {row.id}")
            return
        with transaction.atomic():
            results = [(row, target.write(row, clean)) for row, clean in pending]
        for row, written in results:
            if written:
                counts.changed += 1
                self.stdout.write(f"changed {name} {row.id}")
            else:
                counts.skipped += 1
                self.stdout.write(f"skipped {name} {row.id}: changed during run")
