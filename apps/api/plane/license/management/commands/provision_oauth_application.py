# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import os

from django.contrib.auth.hashers import check_password
from django.core.management.base import BaseCommand
from django.db import transaction
from oauth2_provider.models import get_application_model

Application = get_application_model()


def redirect_uris():
    """The callbacks the chart derived, one per line as DOT stores them."""
    raw = os.environ.get("MCP_OAUTH_REDIRECT_URIS", "")
    return "\n".join(uri.strip() for uri in raw.replace(",", "\n").split("\n") if uri.strip())


class Command(BaseCommand):
    help = "Reconcile the chart-managed OAuth application from the environment"

    def handle(self, *args, **options):
        client_id = os.environ.get("PLANE_OAUTH_PROVIDER_CLIENT_ID", "").strip()
        client_secret = os.environ.get("PLANE_OAUTH_PROVIDER_CLIENT_SECRET", "").strip()
        uris = redirect_uris()

        # Not a chart-provisioned deploy, so there is nothing to reconcile.
        if not (client_id and client_secret and uris):
            return

        fields = {
            "name": os.environ.get("MCP_OAUTH_APP_NAME", "").strip() or "Plane MCP",
            "redirect_uris": uris,
            "client_type": Application.CLIENT_CONFIDENTIAL,
            "authorization_grant_type": Application.GRANT_AUTHORIZATION_CODE,
            # The consent screen is where workspaces are chosen, so it is never
            # skipped. Skipping it issues a token that reaches no workspace.
            "skip_authorization": False,
        }

        # Replicas start together during a rollout, so the row is claimed once.
        with transaction.atomic():
            application = Application.objects.select_for_update().filter(client_id=client_id).first()
            changed = application is None
            if application is None:
                application = Application(client_id=client_id)

            for field, value in fields.items():
                if getattr(application, field) != value:
                    setattr(application, field, value)
                    changed = True

            # Stored hashed, so it can only be compared, never read back.
            if not (application.pk and check_password(client_secret, application.client_secret)):
                application.client_secret = client_secret
                changed = True

            # This runs on every API start, so an unchanged deploy writes nothing.
            if not changed:
                return

            application.full_clean(exclude=["user", "client_secret"])
            application.save()

        self.stdout.write(self.style.SUCCESS(f"OAuth application {fields['name']} reconciled from environment."))
