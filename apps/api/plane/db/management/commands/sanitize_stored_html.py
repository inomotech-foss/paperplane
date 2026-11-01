# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Sanitize user HTML that was stored before its write path sanitized it.

Rows are written with bulk_update, so updated_at, versions, activity and webhooks are not touched.
"""

from dataclasses import dataclass

from django.core.management.base import BaseCommand, CommandError
from django.db import models

from plane.automation.sanitize import HTML_TEMPLATE_FIELDS, template_field
from plane.db.models import (
    AutomationAction,
    Description,
    DraftIssue,
    Issue,
    IssueComment,
    IssueDescriptionVersion,
    Page,
)
from plane.utils.content_validator import validate_html_content
from plane.utils.html_processor import strip_tags


@dataclass(frozen=True)
class HtmlField:
    model: type[models.Model]
    html: str
    stripped: str
    # The value the model's save() stores as stripped text for empty HTML.
    empty_stripped: str | None = None
    # A comment mirrors its HTML into a Description row, which has to follow it.
    mirror: str | None = None

    def rows(self):
        fields = ["id", self.html] + ([self.mirror] if self.mirror else [])
        return self.model.all_objects.only(*fields).order_by("id")

    def html_of(self, row):
        return getattr(row, self.html)

    def write(self, pending):
        self.model.all_objects.bulk_update(
            [
                self.model(id=row.id, **{self.html: clean, self.stripped: _stripped(clean, self.empty_stripped)})
                for row, clean in pending
            ],
            [self.html, self.stripped],
        )
        if self.mirror:
            mirrors = [
                Description(id=getattr(row, self.mirror), description_html=clean, description_stripped=_stripped(clean))
                for row, clean in pending
                if getattr(row, self.mirror)
            ]
            Description.all_objects.bulk_update(mirrors, ["description_html", "description_stripped"])


class AutomationTemplate:
    """The HTML template inside an automation action's config."""

    def rows(self):
        actions = AutomationAction.all_objects.filter(action_type__in=list(HTML_TEMPLATE_FIELDS))
        return actions.only("id", "action_type", "config").order_by("id")

    def html_of(self, row):
        field = template_field(row.action_type, row.config)
        return row.config[field] if field else None

    def write(self, pending):
        actions = [
            AutomationAction(id=row.id, config={**row.config, template_field(row.action_type, row.config): clean})
            for row, clean in pending
        ]
        AutomationAction.all_objects.bulk_update(actions, ["config"])


TARGETS = {
    "page": HtmlField(Page, "description_html", "description_stripped"),
    "issue": HtmlField(Issue, "description_html", "description_stripped"),
    "issue_description_version": HtmlField(IssueDescriptionVersion, "description_html", "description_stripped"),
    "issue_comment": HtmlField(
        IssueComment, "comment_html", "comment_stripped", empty_stripped="", mirror="description_id"
    ),
    "draft_issue": HtmlField(DraftIssue, "description_html", "description_stripped"),
    "automation": AutomationTemplate(),
}


def _stripped(html, empty=None):
    return strip_tags(html) if html else empty


def _summary(label, scanned, changed, failed, apply):
    return f"{label}: scanned {scanned}, {'changed' if apply else 'would change'} {changed}, failed {failed}"


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
        scanned = changed = failed = 0
        pending = []

        for row in target.rows().iterator(chunk_size=batch_size):
            scanned += 1
            html = target.html_of(row)
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
                if apply:
                    target.write(pending)
                pending = []
            if scanned % batch_size == 0:
                self.stdout.write(_summary(name, scanned, changed, failed, apply))

        if apply and pending:
            target.write(pending)
        self.stdout.write(_summary(name, scanned, changed, failed, apply))
        return [scanned, changed, failed]
