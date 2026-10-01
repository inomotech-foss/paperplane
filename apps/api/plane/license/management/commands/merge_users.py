# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.core.management.base import BaseCommand, CommandError

from plane.db.models import User
from plane.license.utils.user_lifecycle import UserLifecycleError
from plane.license.utils.user_merge import merge_users


class Command(BaseCommand):
    help = "Merge one user into another. The source is anonymised and deactivated."

    def add_arguments(self, parser):
        parser.add_argument("source_email", type=str, help="Email of the user to merge away")
        parser.add_argument("survivor_email", type=str, help="Email of the user that stays")
        parser.add_argument("--keep-source-email", action="store_true", help="The survivor takes the source email")
        parser.add_argument("--dry-run", action="store_true", help="Report the counts without writing")

    def handle(self, *args, **options):
        source = User.objects.filter(email=options["source_email"]).first()
        survivor = User.objects.filter(email=options["survivor_email"]).first()
        if source is None or survivor is None:
            raise CommandError("Both users must exist.")

        try:
            result = merge_users(
                survivor,
                source,
                keep_source_email=options["keep_source_email"],
                dry_run=options["dry_run"],
            )
        except UserLifecycleError as error:
            raise CommandError(error.message)

        for key, counts in sorted(result["relations"].items()):
            self.stdout.write(f"{key}: moved {counts['moved']}, dropped {counts['dropped']}")
        verb = "would keep" if options["dry_run"] else "keeps"
        self.stdout.write(self.style.SUCCESS(f"{survivor.id} {verb} the email {result['email']}"))
