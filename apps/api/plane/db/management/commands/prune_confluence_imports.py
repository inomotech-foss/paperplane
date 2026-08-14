# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from plane.db.models import Project, ProjectPage, Workspace
from plane.importers.confluence.backup import ConfluenceBackup, space_keys
from plane.importers.confluence.loader import ConfluenceLoader

EXTERNAL_SOURCE = ConfluenceLoader.EXTERNAL_SOURCE


def _personal_external_ids(backup_dir):
    """external_id values the loader would have assigned to personal spaces.

    Mirrors ConfluenceLoader's own `external_id = str(space.get("id") or
    (space.get("key") or space_key))`, so a project matches here only if it
    was actually imported from a space that space.json marks "personal".
    """
    ids = set()
    for key in space_keys(backup_dir, include_personal=True):
        backup = ConfluenceBackup(backup_dir, key)
        if backup.space_type() != "personal":
            continue
        space = backup.space()
        identifier_key = space.get("key") or key
        ids.add(str(space.get("id") or identifier_key))
    return ids


class Command(BaseCommand):
    help = "Repair already-imported Confluence projects: prune personal spaces, make them secret, hide work items."

    def add_arguments(self, parser):
        parser.add_argument("--backup-dir", required=True, help="Directory holding confluence/<SPACE>/")
        parser.add_argument("--workspace", required=True, help="Target Plane workspace slug")
        parser.add_argument(
            "--no-dry-run", action="store_true", help="Actually commit the changes. Default is a dry run."
        )
        parser.add_argument(
            "--prune-personal",
            action="store_true",
            help="Soft-delete projects imported from personal Confluence spaces",
        )
        parser.add_argument("--make-secret", action="store_true", help="Set network=0 on imported Confluence projects")
        parser.add_argument(
            "--disable-work-items", action="store_true", help="Set issue_view=False on imported Confluence projects"
        )

    def handle(self, *args, **options):
        dry_run = not options["no_dry_run"]

        try:
            workspace = Workspace.objects.get(slug=options["workspace"])
        except Workspace.DoesNotExist:
            raise CommandError(f"No workspace with slug {options['workspace']!r}")

        passes = (options["prune_personal"], options["make_secret"], options["disable_work_items"])

        with transaction.atomic():
            if options["prune_personal"]:
                self._prune_personal(workspace, options["backup_dir"])
            if options["make_secret"]:
                self._make_secret(workspace)
            if options["disable_work_items"]:
                self._disable_work_items(workspace)
            if not any(passes):
                self.stdout.write("no pass selected, nothing to do")

            if dry_run:
                self.stdout.write(self.style.WARNING("dry run, rolled back"))
                transaction.set_rollback(True)
            else:
                self.stdout.write(self.style.WARNING("changes committed"))

    def _prune_personal(self, workspace, backup_dir):
        personal_ids = _personal_external_ids(backup_dir)
        rows = []
        if personal_ids:
            rows = list(
                Project.objects.filter(
                    workspace=workspace, external_source=EXTERNAL_SOURCE, external_id__in=personal_ids
                )
                .order_by("identifier")
                .values_list("id", "identifier")
            )
        self._report("prune-personal", rows)
        if not rows:
            return

        project_ids = [project_id for project_id, _ in rows]
        ProjectPage.objects.filter(project_id__in=project_ids).delete()
        Project.objects.filter(id__in=project_ids).delete()

    def _make_secret(self, workspace):
        queryset = (
            Project.objects.filter(workspace=workspace, external_source=EXTERNAL_SOURCE)
            .exclude(network=0)
            .order_by("identifier")
        )
        rows = list(queryset.values_list("id", "identifier"))
        self._report("make-secret", rows)
        if rows:
            queryset.update(network=0)

    def _disable_work_items(self, workspace):
        queryset = Project.objects.filter(
            workspace=workspace, external_source=EXTERNAL_SOURCE, issue_view=True
        ).order_by("identifier")
        rows = list(queryset.values_list("id", "identifier"))
        self._report("disable-work-items", rows)
        if rows:
            queryset.update(issue_view=False)

    def _report(self, label, rows):
        identifiers = ", ".join(identifier for _, identifier in rows) if rows else "(none)"
        self.stdout.write(f"{label:<18} {len(rows)} project(s): {identifiers}")
