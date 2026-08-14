# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

from django.core.management.base import BaseCommand, CommandError

from plane.db.models import User, Workspace
from plane.importers.jira.backup import JiraBackup
from plane.importers.jira.loader import JiraLoader


class Command(BaseCommand):
    help = "Import a backed-up Jira project into a Plane project."

    def add_arguments(self, parser):
        parser.add_argument("--project", required=True, help="Jira project key, e.g. DEMO")
        parser.add_argument("--backup-dir", required=True, help="Directory holding jira/<PROJECT_KEY>/")
        parser.add_argument("--workspace", required=True, help="Target Plane workspace slug")
        parser.add_argument("--actor", required=True, help="Email of the user to fall back to for unmapped accounts")
        parser.add_argument("--dry-run", action="store_true", help="Roll back instead of committing")

    def handle(self, *args, **options):
        backup = JiraBackup(options["backup_dir"], options["project"])
        if not backup.exists():
            raise CommandError(f"No project.json under {backup.project_dir}")

        try:
            workspace = Workspace.objects.get(slug=options["workspace"])
        except Workspace.DoesNotExist:
            raise CommandError(f"No workspace with slug {options['workspace']!r}")

        try:
            actor = User.objects.get(email=options["actor"])
        except User.DoesNotExist:
            raise CommandError(f"No user with email {options['actor']!r}")

        summary = JiraLoader(workspace.slug, actor, backup).run(dry_run=options["dry_run"])
        self._report(summary, dry_run=options["dry_run"])

    def _report(self, summary, dry_run):
        total = summary.created + summary.updated
        self.stdout.write(f"project     {summary.project_name} ({summary.project_id})")
        if summary.merged:
            self.stdout.write("project     merged into the project already holding this key")
        self.stdout.write(f"work items  {summary.created} created, {summary.updated} updated")
        self.stdout.write(f"vocabulary  {summary.states} states, {summary.issue_types} issue types")
        self.stdout.write(f"comments    {summary.comments}")
        self.stdout.write(f"attributed  {summary.attributed}/{total} to their original author")
        self.stdout.write(f"assets      {summary.attachments} attachments uploaded")

        if summary.attachments_skipped:
            self.stdout.write(self.style.WARNING("assets      not uploaded on a dry run, so links stay unresolved"))
        if summary.actor_fallbacks:
            self.stdout.write(
                self.style.WARNING(f"unmapped    {summary.actor_fallbacks} work items fell back to the actor")
            )
        if summary.unmapped_accounts:
            self.stdout.write(self.style.WARNING(f"accounts    {len(summary.unmapped_accounts)} not in the user map"))
        if summary.missing_attachments:
            self.stdout.write(
                self.style.WARNING(f"missing     {len(summary.missing_attachments)} attachments not in the backup")
            )
        if summary.unsupported_attachments:
            self.stdout.write(
                self.style.WARNING(f"rejected    {len(summary.unsupported_attachments)} attachments of a blocked type")
            )
        if summary.unresolved_attachments:
            self.stdout.write(
                self.style.WARNING(f"dead files  {len(summary.unresolved_attachments)} referenced in a body")
            )
        if summary.nodes.lost or summary.marks.lost:
            lost = summary.nodes.lost + summary.marks.lost
            self.stdout.write(self.style.WARNING(f"lost        {json.dumps(dict(lost))}"))
        if dry_run:
            self.stdout.write(self.style.WARNING("dry run, rolled back"))
