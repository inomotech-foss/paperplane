# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.core.management.base import BaseCommand, CommandError

from plane.db.models import Project, ProjectMember, User
from plane.db.models.project import ROLE_CHOICES


class Command(BaseCommand):
    help = (
        "Grant a user access to a project imported from Confluence. The backup carries no "
        "permission data of any kind, so project membership is the only access control "
        "available, and every grant here is a deliberate human decision."
    )

    def add_arguments(self, parser):
        parser.add_argument("--space", required=True, help="Confluence space key the project was imported from")
        parser.add_argument("--email", required=True, help="Email of the user to grant access to")
        parser.add_argument(
            "--role",
            required=True,
            type=int,
            choices=[value for value, _ in ROLE_CHOICES],
            help="Project role to grant: " + ", ".join(f"{value} ({name})" for value, name in ROLE_CHOICES),
        )

    def handle(self, *args, **options):
        space = options["space"]
        email = options["email"]
        role = options["role"]

        project = Project.objects.filter(external_source="confluence", identifier__iexact=space).first()
        if project is None:
            raise CommandError(f"No Confluence-imported project found for space {space!r}")

        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            raise CommandError(f"No user found with email {email!r}")

        member, created = ProjectMember.objects.get_or_create(project=project, member=user, defaults={"role": role})
        if not created and member.role != role:
            member.role = role
            member.save(update_fields=["role"])

        role_name = dict(ROLE_CHOICES)[role]
        action = "Added" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{action} {email} on {project.name} as {role_name}"))
