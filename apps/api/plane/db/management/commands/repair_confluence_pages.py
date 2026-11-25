# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Repair the tables and includes of pages imported from Confluence.

Imports made before the table normaliser and the include block hold
Confluence table markup and plain links where Confluence showed an included
page. This rewrites each page's HTML the way an import now would, drops the
binary document and JSON so the live server rebuilds them from the HTML (as
the API's PATCH does), and records a page version.

A page whose HTML needs no change but which holds a table and a binary
document gets its binary dropped too: a document stored by the earlier editor
fixed every column it had no width for at 150px, and that width lives in the
binary, not the HTML.
"""

import uuid
from collections import Counter

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from plane.db.models import Page, PageVersion, Project, User
from plane.importers.confluence.loader import ConfluenceLoader
from plane.importers.confluence.repair import SNIPPETS_PARENT_NAME, repair_page_html
from plane.utils.content_validator import validate_html_content
from plane.utils.html_processor import strip_tags
from plane.utils.live_content import notify_live_content_replaced


def _clean(html):
    is_valid, error, clean = validate_html_content(html)
    if not is_valid:
        raise ValueError(error)
    return clean or "<p></p>"


class Command(BaseCommand):
    help = (
        "Normalise the tables of imported Confluence pages and turn their snippet links into include blocks. "
        "Run with --dry-run first."
    )

    def add_arguments(self, parser):
        parser.add_argument("--project", required=True, help="Project id")
        parser.add_argument("--dry-run", action="store_true", help="Report what would change and write nothing")
        parser.add_argument(
            "--snippets-parent",
            default=SNIPPETS_PARENT_NAME,
            help=f"Name of the page whose children are include snippets (default: {SNIPPETS_PARENT_NAME})",
        )
        parser.add_argument("--no-includes", action="store_true", help="Leave snippet links as links")
        parser.add_argument(
            "--all-pages",
            action="store_true",
            help="Also repair pages that were not imported from Confluence (default: imported pages only)",
        )
        parser.add_argument("--include-locked", action="store_true", help="Also repair locked pages")
        parser.add_argument(
            "--actor", help="Email of the user the new page versions are recorded for (default: each page's owner)"
        )
        parser.add_argument("--page", action="append", help="Limit the run to this page id, can be repeated")

    def handle(self, *args, **options):
        project = self._project(options["project"])
        actor = self._actor(options["actor"])
        dry_run = options["dry_run"]

        pages = Page.objects.filter(projects__id=project.id, project_pages__deleted_at__isnull=True).distinct()
        snippet_ids = set() if options["no_includes"] else self._snippet_ids(pages, options["snippets_parent"])

        if not options["all_pages"]:
            pages = pages.filter(external_source=ConfluenceLoader.EXTERNAL_SOURCE)
        if options["page"]:
            pages = pages.filter(id__in=options["page"])

        totals = Counter()
        included = Counter()
        for page in pages.order_by("name", "id").iterator(chunk_size=50):
            totals["scanned"] += 1
            outcome = self._repair(page, snippet_ids, actor, dry_run, options["include_locked"], included)
            totals[outcome] += 1

        verb = "would" if dry_run else "did"
        self.stdout.write(
            f"{'DRY RUN ' if dry_run else ''}project {project.id}: scanned {totals['scanned']}, "
            f"{verb} rewrite {totals['rewritten']}, {verb} only rebuild {totals['rebuilt']}, "
            f"unchanged {totals['unchanged']}, locked {totals['locked']}, "
            f"changed during run {totals['raced']}, failed {totals['failed']}"
        )
        if included:
            names = dict(Page.objects.filter(id__in=list(included)).values_list("id", "name"))
            for page_id, count in included.most_common():
                self.stdout.write(f"  include {names.get(uuid.UUID(page_id), page_id)}: {count}")

    def _project(self, project_id):
        try:
            return Project.objects.get(id=project_id)
        except (Project.DoesNotExist, ValueError, ValidationError) as error:
            raise CommandError(f"No project {project_id}: {error}") from None

    def _actor(self, email):
        if not email:
            return None
        user = User.objects.filter(email=email).first()
        if user is None:
            raise CommandError(f"No user with email {email}")
        return user

    def _snippet_ids(self, pages, parent_name):
        parents = list(pages.filter(name=parent_name).values_list("id", flat=True))
        if len(parents) > 1:
            raise CommandError(f"{len(parents)} pages are named {parent_name!r}; the snippets parent is ambiguous")
        if not parents:
            self.stdout.write(f"no page named {parent_name!r}: snippet links stay links")
            return set()
        snippets = {str(page_id) for page_id in pages.filter(parent_id=parents[0]).values_list("id", flat=True)}
        self.stdout.write(f"{len(snippets)} snippet pages under {parent_name!r}")
        return snippets

    def _repair(self, page, snippet_ids, actor, dry_run, include_locked, included):
        old_html = page.description_html or ""
        try:
            repair = repair_page_html(old_html, snippet_ids)
            new_html = _clean(repair.html)
            # compare sanitised forms: the parser may re-serialise unchanged markup differently
            changed = new_html != _clean(old_html) if old_html else False
        except ValueError as error:
            self.stderr.write(f"failed {page.id} {page.name!r}: {error}")
            return "failed"

        rebuild = repair.has_tables and page.description_binary is not None
        if not changed and not rebuild:
            return "unchanged"
        if page.is_locked and not include_locked:
            self.stdout.write(f"locked {page.id} {page.name!r}: skipped (pass --include-locked to repair it)")
            return "locked"

        detail = f"{repair.tables} tables, {len(repair.includes)} includes"
        if dry_run:
            included.update(repair.includes)
            self.stdout.write(f"would {'rewrite' if changed else 'rebuild'} {page.id} {page.name!r}: {detail}")
            return "rewritten" if changed else "rebuilt"

        values = {"description_binary": None, "description_json": {}}
        if changed:
            values.update(description_html=new_html, description_stripped=strip_tags(new_html))
        with transaction.atomic():
            # filtered on the HTML read, so a page saved meanwhile is left alone
            written = Page.objects.filter(pk=page.pk, description_html=page.description_html).update(**values)
            if not written:
                self.stderr.write(f"changed during run {page.id} {page.name!r}: skipped")
                return "raced"
            if changed:
                self._record_versions(page, old_html, new_html, actor)
            # an open document would otherwise save its old body (and its fixed widths) back
            notify_live_content_replaced(page=page.id, description_html=new_html)

        included.update(repair.includes)
        self.stdout.write(f"{'rewrote' if changed else 'rebuilt'} {page.id} {page.name!r}: {detail}")
        return "rewritten" if changed else "rebuilt"

    @staticmethod
    def _record_versions(page, old_html, new_html, actor):
        """A version for the repaired body, and one for the body it replaces
        when the page has none, so the repair can always be read back."""
        owner_id = actor.id if actor else page.owned_by_id
        now = timezone.now()
        common = {
            "workspace_id": page.workspace_id,
            "page_id": page.id,
            "description_json": {},
            "description_binary": None,
            "sub_pages_data": {},
        }
        if not PageVersion.objects.filter(page_id=page.id).exists():
            PageVersion.objects.create(
                **common,
                owned_by_id=page.owned_by_id,
                last_saved_at=page.updated_at or now,
                description_html=old_html,
            )
        PageVersion.objects.create(**common, owned_by_id=owner_id, last_saved_at=now, description_html=new_html)
