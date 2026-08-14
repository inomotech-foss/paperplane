# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.core.management.base import BaseCommand, CommandError

# Module imports
from plane.license.utils.workspace_provisioning import (
    WorkspaceProvisioningError,
    get_workspace_settings,
    provision_workspace,
)


class Command(BaseCommand):
    help = "Create the workspace configured for provisioning, if it does not exist"

    def handle(self, *args, **options):
        slug, name = get_workspace_settings()
        if not slug:
            self.stdout.write("No workspace configured for provisioning; skipping.")
            return

        try:
            workspace, created = provision_workspace(slug, name)
        except WorkspaceProvisioningError as e:
            raise CommandError(str(e))

        if created:
            self.stdout.write(self.style.SUCCESS(f"Created workspace {workspace.slug}."))
        else:
            self.stdout.write(f"Workspace {workspace.slug} already exists; left untouched.")
