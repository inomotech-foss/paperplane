# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

from django.core.management.base import BaseCommand, CommandError

from plane.db.models import User, Workspace
from plane.importers.confluence.backup import ConfluenceBackup
from plane.importers.confluence.loader import ConfluenceLoader


class Command(BaseCommand):
    help = "Import a backed-up Confluence space into a Plane project."

    def add_arguments(self, parser):
        parser.add_argument("--space", required=True, help="Confluence space key, e.g. IMS")
        parser.add_argument("--backup-dir", required=True, help="Directory holding confluence/<SPACE>/")
        parser.add_argument("--workspace", required=True, help="Target Plane workspace slug")
        parser.add_argument("--actor", required=True, help="Email of the user to fall back to for unmapped authors")
        parser.add_argument("--dry-run", action="store_true", help="Roll back instead of committing")
        parser.add_argument(
            "--plan",
            action="store_true",
            help="Dry run that also lists every page it would create, move, rename or archive",
        )
        parser.add_argument(
            "--structure-only",
            action="store_true",
            help="Repair parents, order, archive flags and folder placeholders without rewriting existing bodies",
        )
        parser.add_argument(
            "--include-personal", action="store_true", help="Allow importing a personal Confluence space"
        )

    def handle(self, *args, **options):
        backup = ConfluenceBackup(options["backup_dir"], options["space"])
        if not backup.exists():
            raise CommandError(f"No space.json under {backup.space_dir}")
        if backup.space_type() == "personal" and not options["include_personal"]:
            raise CommandError(f"{options['space']} is a personal space; pass --include-personal to import it")

        try:
            workspace = Workspace.objects.get(slug=options["workspace"])
        except Workspace.DoesNotExist:
            raise CommandError(f"No workspace with slug {options['workspace']!r}")

        try:
            actor = User.objects.get(email=options["actor"])
        except User.DoesNotExist:
            raise CommandError(f"No user with email {options['actor']!r}")

        dry_run = options["dry_run"] or options["plan"]
        loader = ConfluenceLoader(workspace.slug, actor, backup)
        summary = loader.run(dry_run=dry_run, structure_only=options["structure_only"])
        self._report(summary, dry_run=dry_run)
        if options["plan"]:
            self._plan(summary)

    def _report(self, summary, dry_run):
        total = summary.created + summary.updated
        self.stdout.write(f"project     {summary.project_name} ({summary.project_id})")
        self.stdout.write(f"pages       {summary.created} created, {summary.updated} updated, {summary.roots} roots")
        if summary.containers:
            self.stdout.write(f"folders     {summary.containers} placeholder pages for folders and databases")
        if summary.archived:
            self.stdout.write(f"archived    {summary.archived} pages archived as in Confluence")
        if summary.locally_edited:
            self.stdout.write(f"kept        {summary.locally_edited} pages edited in Plane, bodies left alone")
        if summary.owner_granted:
            self.stdout.write("owner       space owner added as project admin")
        self.stdout.write(f"attributed  {summary.attributed}/{total} to their original author")
        self.stdout.write(f"assets      {summary.attachments} attachments uploaded")

        if summary.attachments_skipped:
            self.stdout.write(self.style.WARNING("assets      not uploaded on a dry run, so links stay unresolved"))
        if summary.unmapped_authors:
            self.stdout.write(
                self.style.WARNING(
                    f"unmapped    {len(summary.unmapped_authors)} Confluence authors, fell back to actor"
                )
            )
        if summary.unresolved_pages:
            self.stdout.write(self.style.WARNING(f"dead links  {len(summary.unresolved_pages)} unresolved page titles"))
        if summary.unresolved_wiki_urls:
            self.stdout.write(
                self.style.WARNING(
                    f"dead urls   {len(summary.unresolved_wiki_urls)} Confluence page URLs not in the backup"
                )
            )
        if summary.unresolved_attachments:
            self.stdout.write(
                self.style.WARNING(
                    f"dead files  {len(summary.unresolved_attachments)} referenced but not in the backup"
                )
            )
        if summary.unsupported_attachments:
            self.stdout.write(
                self.style.WARNING(f"rejected    {len(summary.unsupported_attachments)} attachments of a blocked type")
            )
        if summary.unsupported_macros:
            self.stdout.write(self.style.WARNING(f"macros      {json.dumps(dict(summary.unsupported_macros))}"))
        if summary.dropped_layouts:
            self.stdout.write(self.style.WARNING(f"layouts     {summary.dropped_layouts} multi-column flattened"))
        if summary.downgraded:
            self.stdout.write(f"downgraded  {json.dumps(dict(summary.downgraded))}")
        if summary.dropped_chrome:
            self.stdout.write(f"chrome      {json.dumps(dict(summary.dropped_chrome))}")
        if dry_run:
            self.stdout.write(self.style.WARNING("dry run, rolled back"))

    KINDS = ("create", "move", "rename", "archive", "keep")

    def _plan(self, summary):
        counts = ", ".join(f"{kind} {sum(1 for c in summary.changes if c.kind == kind)}" for kind in self.KINDS)
        self.stdout.write(f"plan        {counts}, reorder {summary.reordered}")
        for kind in self.KINDS:
            for change in sorted((c for c in summary.changes if c.kind == kind), key=lambda c: c.title.casefold()):
                detail = f": {change.detail}" if change.detail else ""
                self.stdout.write(f"  {kind:<8}{change.title}{detail}")
