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

    def handle(self, *args, **options):
        backup = ConfluenceBackup(options["backup_dir"], options["space"])
        if not backup.exists():
            raise CommandError(f"No space.json under {backup.space_dir}")

        try:
            workspace = Workspace.objects.get(slug=options["workspace"])
        except Workspace.DoesNotExist:
            raise CommandError(f"No workspace with slug {options['workspace']!r}")

        try:
            actor = User.objects.get(email=options["actor"])
        except User.DoesNotExist:
            raise CommandError(f"No user with email {options['actor']!r}")

        loader = ConfluenceLoader(workspace.slug, actor, backup)
        summary = loader.run(dry_run=options["dry_run"])
        self._report(summary, dry_run=options["dry_run"])

    def _report(self, summary, dry_run):
        total = summary.created + summary.updated
        self.stdout.write(f"project     {summary.project_name} ({summary.project_id})")
        self.stdout.write(f"pages       {summary.created} created, {summary.updated} updated, {summary.roots} roots")
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
