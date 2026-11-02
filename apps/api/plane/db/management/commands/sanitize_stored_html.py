# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Sanitize user HTML that was stored before its write path sanitized it.

Each row is written with a queryset update filtered on its old value, so updated_at, versions,
activity and webhooks are not touched, and a row edited during the run is skipped, not overwritten.
"""

import uuid
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
    help = (
        "Sanitize stored user HTML (dry run unless --apply is given). "
        "Run it in a separate one-off pod or job, not inside a serving API pod."
    )

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
        parser.add_argument("--batch-size", type=int, default=10, help="Rows fetched per query")
        parser.add_argument("--max-rows", type=int, help="Stop each model after scanning this many rows")
        parser.add_argument("--start-after", help="Resume after this id (needs a single --model)")

    def handle(self, *args, **options):
        batch_size = options["batch_size"]
        if batch_size < 1:
            raise CommandError("--batch-size must be at least 1")
        max_rows = options["max_rows"]
        if max_rows is not None and max_rows < 1:
            raise CommandError("--max-rows must be at least 1")
        names = options["model"] or list(TARGETS)
        start_after = options["start_after"]
        if start_after is not None:
            try:
                start_after = uuid.UUID(start_after)
            except ValueError:
                raise CommandError(f"--start-after must be a UUID, got {start_after!r}") from None
            if len(names) != 1:
                raise CommandError("--start-after needs exactly one --model")

        apply = options["apply"]
        totals = Counts()
        for name in names:
            totals.add(self._sanitize(name, TARGETS[name], apply, batch_size, max_rows, start_after))
        self.stdout.write(totals.summary("done", apply))

    def _sanitize(self, name, target, apply, batch_size, max_rows, start_after):
        counts = Counts()
        last_id = None

        for row in _rows(target.rows(), batch_size, start_after):
            counts.scanned += 1
            last_id = row.pk
            self._sanitize_row(name, target, row, apply, counts)
            del row
            if counts.scanned % 500 == 0:
                self.stdout.write(f"{counts.summary(name, apply)}, last id {last_id}")
            if counts.scanned == max_rows:
                if target.rows().filter(id__gt=last_id).exists():
                    self.stdout.write(
                        f"{name}: stopped at --max-rows, resume with --model {name} --start-after {last_id}"
                    )
                break

        self.stdout.write(counts.summary(name, apply))
        return counts

    def _sanitize_row(self, name, target, row, apply, counts):
        html = target.html_of(row)
        if not html:
            return
        is_valid, error, clean = validate_html_content(html)
        if not is_valid:
            counts.failed += 1
            self.stderr.write(f"rejected {name} {row.pk}: {error}")
            return
        if clean == html:
            return
        if not apply:
            counts.changed += 1
            self.stdout.write(f"would change {name} {row.pk}")
            return
        with transaction.atomic():
            written = target.write(row, clean)
        if written:
            counts.changed += 1
            self.stdout.write(f"changed {name} {row.pk}")
        else:
            counts.skipped += 1
            self.stdout.write(f"skipped {name} {row.pk}: changed during run")


def _rows(queryset, batch_size, start_after):
    """Yields rows by keyset pagination on id, holding at most one batch and dropping each row once yielded."""
    last_id = start_after
    while True:
        batch = list((queryset if last_id is None else queryset.filter(id__gt=last_id))[:batch_size])
        if not batch:
            return
        last_id = batch[-1].pk
        batch.reverse()
        while batch:
            yield batch.pop()
