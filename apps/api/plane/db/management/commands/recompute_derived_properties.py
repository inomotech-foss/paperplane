# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Recompute the property values derived from the work item hierarchy.

Derived values are refreshed on every write that can change them; this command is the
repair tool for anything that bypassed that (a raw SQL change, a restored backup).
"""

from django.core.management.base import BaseCommand, CommandError

from plane.db.models import IssueProperty, Project, PropertyDerivationChoices
from plane.utils.derived_properties import refresh_derived_values


class Command(BaseCommand):
    help = "Recompute inherited, looked up and rolled up property values"

    def add_arguments(self, parser):
        parser.add_argument("--workspace", help="Workspace slug (default: every workspace)")
        parser.add_argument("--project", help="Project identifier, e.g. SALES (needs --workspace)")

    def handle(self, *args, **options):
        projects = Project.objects.all()
        if options["workspace"]:
            projects = projects.filter(workspace__slug=options["workspace"])
        if options["project"]:
            if not options["workspace"]:
                raise CommandError("--project needs --workspace")
            projects = projects.filter(identifier__iexact=options["project"])
            if not projects.exists():
                raise CommandError(f"No project '{options['project']}' in workspace '{options['workspace']}'")

        with_derived = IssueProperty.objects.exclude(derivation=PropertyDerivationChoices.NONE).values("project_id")
        for project in projects.filter(id__in=with_derived).order_by("identifier"):
            result = refresh_derived_values(project.id)
            self.stdout.write(
                f"{project.workspace.slug}/{project.identifier}: "
                f"{result['created']} values written, {result['deleted']} removed"
            )
