# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Put the current content of a project's pages in force as a baseline.

For a wiki that switches page approvals on with content that was approved
elsewhere (or never), so readers get a stable version in force from day one.
A baseline is not an approval: nobody reviewed the content in Paperplane, it
names no approver and every status shows it as a baseline. The approval a
page recorded itself (a Confluence "Document status" table) is carried over
as text. The first real approval replaces the baseline.

Only pristine drafts are baselined, so running the command again changes
nothing. Run with --dry-run first.
"""

from collections import Counter
from datetime import date

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from plane.db.models import Page, Project, User
from plane.importers.confluence.document_status import parse_document_status
from plane.utils import page_approval
from plane.utils.page_approval import ApprovalError


class Command(BaseCommand):
    help = (
        "Mark the current content of a project's pages as the version in force, as a baseline that is "
        "clearly not an approval. Run with --dry-run first."
    )

    def add_arguments(self, parser):
        parser.add_argument("--project", required=True, help="Project id; page approvals must be enabled")
        parser.add_argument(
            "--actor",
            required=True,
            help="Email of the admin running the baseline; recorded on each baselined event (not as approver)",
        )
        parser.add_argument("--dry-run", action="store_true", help="Report what would happen and write nothing")
        parser.add_argument(
            "--next-review",
            help="Schedule the first real review of every baselined page for this date (YYYY-MM-DD). "
            "Default: leave the review date as it is (normally none)",
        )
        parser.add_argument("--page", action="append", help="Limit the run to this page id, can be repeated")
        parser.add_argument("--include-locked", action="store_true", help="Also baseline locked pages")
        parser.add_argument("--comment", default="", help="Comment recorded on each baselined event")

    def handle(self, *args, **options):
        project = self._project(options["project"])
        actor = self._actor(options["actor"])
        next_review = self._date(options["next_review"])
        dry_run = options["dry_run"]

        pages = Page.objects.filter(projects__id=project.id, project_pages__deleted_at__isnull=True).distinct()
        if options["page"]:
            pages = pages.filter(id__in=options["page"])
            missing = set(options["page"]) - {str(page_id) for page_id in pages.values_list("id", flat=True)}
            if missing:
                raise CommandError(f"Not pages of project {project.id}: {', '.join(sorted(missing))}")

        totals = Counter()
        legacy_kinds = Counter()
        skipped = Counter()
        for page in pages.order_by("name", "id").iterator(chunk_size=50):
            totals["scanned"] += 1
            outcome = self._baseline(page, project, actor, next_review, options, legacy_kinds, skipped)
            totals[outcome] += 1

        verb = "would baseline" if dry_run else "baselined"
        self.stdout.write(
            f"{'DRY RUN ' if dry_run else ''}project {project.id}: scanned {totals['scanned']}, "
            f"{verb} {totals['baselined']} (Confluence approval carried over {legacy_kinds['approved']}, "
            f"other Confluence status {legacy_kinds['other']}, no prior approval recorded {legacy_kinds['none']}), "
            f"skipped {totals['skipped']}, failed {totals['failed']}"
        )
        for reason, count in sorted(skipped.items()):
            self.stdout.write(f"  skipped, {reason}: {count}")
        if next_review:
            self.stdout.write(f"  next review of baselined pages: {next_review.isoformat()}")
        if dry_run:
            self.stdout.write("DRY RUN: nothing was written. Run again without --dry-run to baseline.")

    def _project(self, project_id):
        try:
            project = Project.objects.get(id=project_id)
        except (Project.DoesNotExist, ValueError, ValidationError) as error:
            raise CommandError(f"No project {project_id}: {error}") from None
        if not project.is_page_approval_enabled:
            raise CommandError(f"Page approvals are not enabled for project {project.id}; switch them on first")
        return project

    def _actor(self, email):
        user = User.objects.filter(email=email).first()
        if user is None:
            raise CommandError(f"No user with email {email}")
        if not user.is_active or user.is_bot:
            raise CommandError(f"{email} is not an active person")
        return user

    def _date(self, value):
        if not value:
            return None
        try:
            parsed = date.fromisoformat(value)
        except ValueError:
            raise CommandError(f"--next-review must be a date as YYYY-MM-DD, not {value!r}") from None
        if parsed < timezone.now().date():
            self.stderr.write(f"warning: --next-review {parsed.isoformat()} is in the past; every page will be overdue")
        return parsed

    def _baseline(self, page, project, actor, next_review, options, legacy_kinds, skipped):
        label = f"{page.id} {page.name!r}"
        reason = page_approval.baseline_refusal(page)
        if reason is None and page.is_locked and not options["include_locked"]:
            reason = "locked (pass --include-locked)"
        if reason:
            skipped[reason.split(" (")[0]] += 1
            self.stdout.write(f"skip {label}: {reason}")
            return "skipped"

        legacy = parse_document_status(page.description_html)
        note = page_approval.legacy_note(
            legacy.status if legacy else "",
            legacy.approved_by if legacy else "",
            legacy.approved_at if legacy else None,
            legacy.approved_at_raw if legacy else "",
        )
        if options["dry_run"]:
            self.stdout.write(f"would baseline {label}: {note}")
        else:
            try:
                page_approval.baseline(
                    page,
                    project.id,
                    actor,
                    legacy=legacy,
                    next_review_date=next_review,
                    comment=options["comment"],
                )
            except ApprovalError as error:
                # e.g. someone submitted the page while the command ran
                self.stderr.write(f"failed {label}: {error.message}")
                return "failed"
            self.stdout.write(f"baselined {label}: {note}")

        if legacy is None:
            legacy_kinds["none"] += 1
        elif legacy.is_approved:
            legacy_kinds["approved"] += 1
        else:
            legacy_kinds["other"] += 1
        return "baselined"
