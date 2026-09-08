# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.core.management.base import BaseCommand, CommandError

# Module imports
from plane.db.models import Project
from plane.utils.issue_sequence import IssueSequenceStartError, set_next_issue_sequence


class Command(BaseCommand):
    help = (
        "Make the next work item created in a project receive a given sequence number, "
        "e.g. so new items start at PROJ-5000 while existing items keep their numbers. "
        "Numbers only ever count up, so the target must exceed the current maximum."
    )

    def add_arguments(self, parser):
        parser.add_argument("--workspace", required=True, help="Slug of the workspace the project belongs to")
        parser.add_argument("--project", required=True, help="Project identifier, e.g. ISFUN")
        parser.add_argument(
            "--start",
            required=True,
            type=int,
            help="Sequence number the next created work item should receive, e.g. 5000",
        )

    def handle(self, *args, **options):
        workspace_slug = options["workspace"]
        project_identifier = options["project"]
        start = options["start"]

        project = Project.objects.filter(workspace__slug=workspace_slug, identifier__iexact=project_identifier).first()
        if project is None:
            raise CommandError(f"No project {project_identifier!r} found in workspace {workspace_slug!r}")

        try:
            previous = set_next_issue_sequence(project, start)
        except IssueSequenceStartError as e:
            raise CommandError(str(e))

        self.stdout.write(
            self.style.SUCCESS(
                f"Next work item in {project.identifier} will be {project.identifier}-{start} "
                f"(previous maximum was {project.identifier}-{previous})"
            )
        )
