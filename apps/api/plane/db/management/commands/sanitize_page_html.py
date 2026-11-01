# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Sanitize the stored description_html of pages written before page create and update sanitized it.

Rows are written with bulk_update, so updated_at, page versions, activity and webhooks are not touched.
"""

from django.core.management.base import BaseCommand, CommandError

from plane.db.models import Page
from plane.utils.content_validator import validate_html_content
from plane.utils.html_processor import strip_tags


class Command(BaseCommand):
    help = "Sanitize the stored description_html of every page (dry run unless --apply is given)"

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument("--dry-run", action="store_true", help="Report the pages that would change (default)")
        mode.add_argument("--apply", action="store_true", help="Write the sanitized HTML")
        parser.add_argument("--batch-size", type=int, default=500, help="Rows read and written per batch")

    def handle(self, *args, **options):
        apply = options["apply"]
        batch_size = options["batch_size"]
        if batch_size < 1:
            raise CommandError("--batch-size must be at least 1")

        pages = Page.all_objects.only("id", "description_html").order_by("id")
        scanned = changed = failed = 0
        pending = []

        for page in pages.iterator(chunk_size=batch_size):
            scanned += 1
            html = page.description_html
            if html:
                is_valid, error, clean = validate_html_content(html)
                if not is_valid:
                    failed += 1
                    self.stderr.write(f"rejected {page.id}: {error}")
                elif clean != html:
                    changed += 1
                    self.stdout.write(f"{'changed' if apply else 'would change'} {page.id}")
                    pending.append(Page(id=page.id, description_html=clean, description_stripped=strip_tags(clean)))

            if len(pending) >= batch_size:
                self._write(pending, apply)
                pending = []
            if scanned % batch_size == 0:
                self.stdout.write(f"scanned {scanned}, changed {changed}, failed {failed}")

        self._write(pending, apply)
        verb = "changed" if apply else "would change"
        self.stdout.write(f"done: scanned {scanned}, {verb} {changed}, failed {failed}")

    @staticmethod
    def _write(pages, apply):
        if apply and pages:
            Page.all_objects.bulk_update(pages, ["description_html", "description_stripped"])
