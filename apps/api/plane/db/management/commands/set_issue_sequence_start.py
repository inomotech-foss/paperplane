# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.db.models import Max

# Module imports
from plane.db.models import IssueSequence, Project
from plane.utils.uuid import convert_uuid_to_integer


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

        if start < 2:
            raise CommandError("--start must be at least 2")

        project = Project.objects.filter(workspace__slug=workspace_slug, identifier__iexact=project_identifier).first()
        if project is None:
            raise CommandError(f"No project {project_identifier!r} found in workspace {workspace_slug!r}")

        with transaction.atomic():
            # Issue.save() serialises sequence allocation per project with this advisory lock; take the
            # same lock so a work item created right now cannot claim a number below the new start.
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_xact_lock(%s)", [convert_uuid_to_integer(project.id)])

            current = IssueSequence.objects.filter(project=project).aggregate(largest=Max("sequence"))["largest"] or 0
            if start <= current:
                raise CommandError(
                    f"{project.identifier} already reaches {project.identifier}-{current}; "
                    f"--start must be greater than {current}"
                )

            # Issue.save() assigns MAX(sequence) + 1, so a placeholder at start - 1 with no work item
            # attached makes the next created work item receive exactly `start`.
            IssueSequence.objects.create(project=project, issue=None, sequence=start - 1)

        self.stdout.write(
            self.style.SUCCESS(
                f"Next work item in {project.identifier} will be {project.identifier}-{start} "
                f"(previous maximum was {project.identifier}-{current})"
            )
        )
