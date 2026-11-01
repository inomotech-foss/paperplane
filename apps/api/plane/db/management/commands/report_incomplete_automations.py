# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""List enabled automations the engine would refuse to run. Read-only: nothing is changed."""

from django.core.management.base import BaseCommand, CommandError

from plane.automation import engine
from plane.db.models import Automation


class Command(BaseCommand):
    help = "List enabled automations with an incomplete trigger, condition or action. Changes nothing."

    def handle(self, *args, **options):
        automations = (
            Automation.objects.filter(is_enabled=True)
            .select_related("workspace")
            .prefetch_related("actions")
            .order_by("workspace__slug", "name")
        )
        incomplete = 0
        for automation in automations:
            result = engine.incomplete_run(automation, engine.load_actions(automation))
            if result is None:
                continue
            incomplete += 1
            error, steps = result
            self.stdout.write(f"{automation.workspace.slug} {automation.id} {automation.name!r}: {error}")
            for step in steps:
                self.stdout.write(f"  action {step['action_id']} ({step['action_type']}): {step['error']}")

        if incomplete:
            raise CommandError(f"{incomplete} enabled automation(s) are incomplete.")
        self.stdout.write("Every enabled automation is complete.")
