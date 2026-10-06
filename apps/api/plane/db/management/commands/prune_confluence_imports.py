# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from plane.db.models import Project, ProjectMember, ProjectPage, User, Workspace
from plane.importers.confluence.backup import ConfluenceBackup, space_keys
from plane.importers.confluence.loader import ConfluenceLoader

EXTERNAL_SOURCE = ConfluenceLoader.EXTERNAL_SOURCE
ADMIN_ROLE = 20


def _spaces(backup_dir):
    """Space key -> ConfluenceBackup for every space in the backup, personal included."""
    return {key: ConfluenceBackup(backup_dir, key) for key in space_keys(backup_dir, include_personal=True)}


def _external_id(backup):
    """The external_id the loader assigned to this space's project.

    Mirrors ConfluenceLoader's own `external_id = str(space.get("id") or
    (space.get("key") or space_key))`.
    """
    space = backup.space()
    return str(space.get("id") or space.get("key") or backup.space_key)


class Command(BaseCommand):
    help = (
        "Repair already-imported Confluence projects: prune personal spaces, make them secret, "
        "hide work items or pages, archive stale spaces, hand personal spaces to their owners."
    )

    def add_arguments(self, parser):
        parser.add_argument("--backup-dir", required=True, help="Directory holding confluence/<SPACE>/")
        parser.add_argument("--workspace", required=True, help="Target Plane workspace slug")
        parser.add_argument(
            "--no-dry-run", action="store_true", help="Actually commit the changes. Default is a dry run."
        )
        parser.add_argument("--spaces", help="Comma-separated space keys to limit every pass to")
        parser.add_argument(
            "--personal", action="store_true", help="Limit every pass to projects imported from personal spaces"
        )
        parser.add_argument(
            "--prune-personal",
            action="store_true",
            help="Soft-delete projects imported from personal Confluence spaces",
        )
        parser.add_argument("--make-secret", action="store_true", help="Set network=0 on the projects in scope")
        parser.add_argument(
            "--disable-work-items", action="store_true", help="Set issue_view=False on the projects in scope"
        )
        parser.add_argument(
            "--disable-pages",
            action="store_true",
            help="Set page_view=False on the projects named by --spaces, whatever they were imported from",
        )
        parser.add_argument(
            "--archive-stale", action="store_true", help="Archive projects whose space is archived in Confluence"
        )
        parser.add_argument(
            "--archive", action="store_true", help="Archive the projects named by --spaces, whatever Confluence says"
        )
        parser.add_argument(
            "--assign-owners", action="store_true", help="Make each space's Confluence owner a project admin"
        )

    def handle(self, *args, **options):
        dry_run = not options["no_dry_run"]
        try:
            workspace = Workspace.objects.get(slug=options["workspace"])
        except Workspace.DoesNotExist:
            raise CommandError(f"No workspace with slug {options['workspace']!r}")

        spaces = _spaces(options["backup_dir"])
        keys = [key.strip() for key in (options["spaces"] or "").split(",") if key.strip()]
        unknown = [key for key in keys if key not in spaces]
        if unknown and not options["disable_pages"]:
            raise CommandError(f"Not in the backup: {', '.join(unknown)}")

        passes = (
            options["prune_personal"],
            options["make_secret"],
            options["disable_work_items"],
            options["disable_pages"],
            options["archive_stale"],
            options["archive"],
            options["assign_owners"],
        )
        with transaction.atomic():
            scope = self._scope(workspace, spaces, keys, options["personal"])
            if options["prune_personal"]:
                self._prune_personal(self._scope(workspace, spaces, keys, personal=True))
            if options["make_secret"]:
                self._make_secret(scope)
            if options["disable_work_items"]:
                self._disable_work_items(scope)
            if options["disable_pages"]:
                self._disable_pages(workspace, keys)
            if options["archive_stale"]:
                self._archive_stale(scope, spaces)
            if options["archive"]:
                self._archive(scope, keys)
            if options["assign_owners"]:
                self._assign_owners(scope, spaces, options["backup_dir"])
            if not any(passes):
                self.stdout.write("no pass selected, nothing to do")
            if dry_run:
                self.stdout.write(self.style.WARNING("dry run, rolled back"))
                transaction.set_rollback(True)
            else:
                self.stdout.write(self.style.WARNING("changes committed"))

    def _scope(self, workspace, spaces, keys, personal):
        """The Confluence-imported projects the passes may touch."""
        queryset = Project.objects.filter(workspace=workspace, external_source=EXTERNAL_SOURCE)
        selected = spaces
        if keys:
            selected = {key: spaces[key] for key in keys if key in spaces}
        if personal:
            selected = {key: backup for key, backup in selected.items() if backup.space_type() == "personal"}
        if keys or personal:
            queryset = queryset.filter(external_id__in={_external_id(backup) for backup in selected.values()})
        return queryset.order_by("identifier")

    def _prune_personal(self, scope):
        rows = list(scope.values_list("id", "identifier"))
        self._report("prune-personal", rows)
        if not rows:
            return
        project_ids = [project_id for project_id, _ in rows]
        ProjectPage.objects.filter(project_id__in=project_ids).delete()
        Project.objects.filter(id__in=project_ids).delete()

    def _make_secret(self, scope):
        queryset = scope.exclude(network=0)
        rows = list(queryset.values_list("id", "identifier"))
        self._report("make-secret", rows)
        if rows:
            queryset.update(network=0)

    def _disable_work_items(self, scope):
        queryset = scope.filter(issue_view=True)
        rows = list(queryset.values_list("id", "identifier"))
        self._report("disable-work-items", rows)
        if rows:
            queryset.update(issue_view=False)

    def _disable_pages(self, workspace, keys):
        """Keyed on the project identifier, not the backup: the projects with
        no wiki of their own are the Jira ones, which the backup's space list
        does not know."""
        if not keys:
            raise CommandError("--disable-pages needs --spaces to name the projects")
        queryset = Project.objects.filter(workspace=workspace, identifier__in=keys, page_view=True).order_by(
            "identifier"
        )
        rows = list(queryset.values_list("id", "identifier"))
        self._report("disable-pages", rows)
        if rows:
            queryset.update(page_view=False)

    def _archive_stale(self, scope, spaces):
        archived_ids = {_external_id(backup) for backup in spaces.values() if backup.space_status() == "archived"}
        queryset = scope.filter(external_id__in=archived_ids, archived_at__isnull=True)
        rows = list(queryset.values_list("id", "identifier"))
        self._report("archive-stale", rows)
        if rows:
            queryset.update(archived_at=timezone.now())

    def _archive(self, scope, keys):
        """For a space that is still current in Confluence but whose team is gone."""
        if not keys:
            raise CommandError("--archive needs --spaces to name the projects")
        queryset = scope.filter(archived_at__isnull=True)
        rows = list(queryset.values_list("id", "identifier"))
        self._report("archive", rows)
        if rows:
            queryset.update(archived_at=timezone.now())

    @staticmethod
    def _active_users():
        """Active Plane users keyed the ways a Confluence account can match one.

        The backup's addresses are often on an old domain, so besides the full
        address the part before the @ and the display name are tried, the
        same fallbacks the loader uses for authorship.
        """
        by_key = {}
        for user in User.objects.filter(is_active=True, is_bot=False):
            names = (
                user.email,
                (user.email or "").split("@")[0],
                user.display_name,
                f"{user.first_name} {user.last_name}",
            )
            for name in names:
                key = (name or "").strip().casefold()
                if key:
                    by_key.setdefault(key, user)
        return by_key

    @staticmethod
    def _match(account, users):
        for name in (account.email, (account.email or "").split("@")[0], account.display_name):
            key = (name or "").strip().casefold()
            if key and key in users:
                return users[key]
        return None

    def _assign_owners(self, scope, spaces, backup_dir):
        """Grant the space owner admin on the project.

        Anyone without an active Plane account is reported, not invented.
        """
        accounts = ConfluenceBackup(backup_dir, next(iter(spaces), "")).users() if spaces else {}
        users = self._active_users()
        by_external_id = {_external_id(backup): backup for backup in spaces.values()}
        rows, missing = [], []
        for project in scope:
            backup = by_external_id.get(project.external_id)
            account = accounts.get(backup.space_owner_id()) if backup else None
            user = self._match(account, users) if account else None
            if user is None:
                missing.append(project.identifier)
                continue
            member, created = ProjectMember.objects.get_or_create(
                project=project, member=user, defaults={"role": ADMIN_ROLE}
            )
            if not created and member.role == ADMIN_ROLE and member.is_active:
                continue
            if not created:
                member.role = ADMIN_ROLE
                member.is_active = True
                member.save(update_fields=["role", "is_active"])
            rows.append((project.id, f"{project.identifier} -> {user.email}"))
        self._report("assign-owners", rows)
        if missing:
            self.stdout.write(self.style.WARNING(f"no active user for the owner of: {', '.join(missing)}"))

    def _report(self, label, rows):
        identifiers = ", ".join(identifier for _, identifier in rows) if rows else "(none)"
        self.stdout.write(f"{label:<18} {len(rows)} project(s): {identifiers}")
