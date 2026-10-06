# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from plane.db.models import ProjectUserProperty, User
from plane.utils.project_sort_order import SORT_ORDER_STEP


class Command(BaseCommand):
    help = "Reset the sidebar order of a user's projects to alphabetical by name within each workspace."

    def add_arguments(self, parser):
        target = parser.add_mutually_exclusive_group(required=True)
        target.add_argument("--email", help="Email of the user to reorder")
        target.add_argument("--all-users", action="store_true", help="Reorder every user")
        parser.add_argument(
            "--no-dry-run", action="store_true", help="Actually commit the changes. Default is a dry run."
        )

    def handle(self, *args, **options):
        dry_run = not options["no_dry_run"]

        if options["all_users"]:
            user_ids = ProjectUserProperty.objects.values_list("user_id", flat=True).distinct()
            users = User.objects.filter(id__in=user_ids).order_by("email")
        else:
            users = User.objects.filter(email=options["email"])
            if not users:
                raise CommandError(f"No user with email {options['email']!r}")

        with transaction.atomic():
            for user in users:
                self._reorder_user(user)

            if dry_run:
                self.stdout.write(self.style.WARNING("dry run, rolled back"))
                transaction.set_rollback(True)
            else:
                self.stdout.write(self.style.WARNING("changes committed"))

    def _reorder_user(self, user):
        properties = (
            ProjectUserProperty.objects.filter(user=user, project__deleted_at__isnull=True)
            .select_related("project", "workspace")
            .order_by("workspace__slug")
        )
        by_workspace = {}
        for prop in properties:
            by_workspace.setdefault(prop.workspace, []).append(prop)

        for workspace, props in by_workspace.items():
            props.sort(key=lambda p: (p.project.name.lower(), str(p.project_id)))
            changed = []
            for index, prop in enumerate(props, start=1):
                new_order = index * SORT_ORDER_STEP
                if prop.sort_order != new_order:
                    self.stdout.write(
                        f"{user.email} {workspace.slug} {prop.project.name}: {prop.sort_order} -> {new_order}"
                    )
                    prop.sort_order = new_order
                    changed.append(prop)
            ProjectUserProperty.objects.bulk_update(changed, ["sort_order"])
        self.stdout.write(f"{user.email}: {sum(len(v) for v in by_workspace.values())} projects checked")
