# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from oauth2_provider.generators import generate_client_secret
from oauth2_provider.models import get_application_model
from rest_framework import status
from rest_framework.response import Response

from plane.license.api.permissions import InstanceAdminPermission

from .base import BaseAPIView

Application = get_application_model()


def serialize(application):
    return {
        "id": application.id,
        "name": application.name,
        "client_id": application.client_id,
        "redirect_uris": application.redirect_uris,
        "created": application.created.isoformat(),
    }


class InstanceOAuthApplicationEndpoint(BaseAPIView):
    """Register OAuth clients such as the MCP server.

    Client secrets are hashed on save, so the secret is returned once at
    creation and cannot be recovered afterwards.
    """

    permission_classes = [InstanceAdminPermission]

    def get(self, request):
        applications = Application.objects.order_by("name")
        return Response([serialize(application) for application in applications], status=status.HTTP_200_OK)

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        redirect_uris = (request.data.get("redirect_uris") or "").strip()
        if not name or not redirect_uris:
            return Response(
                {"error": "name and redirect_uris are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client_secret = generate_client_secret()
        application = Application(
            name=name,
            redirect_uris=redirect_uris,
            client_type=Application.CLIENT_CONFIDENTIAL,
            authorization_grant_type=Application.GRANT_AUTHORIZATION_CODE,
            client_secret=client_secret,
            # The consent screen is where the workspace selection is made, so it
            # is never skipped. Skipping it issues a token with no installations,
            # which then fails on every workspace route.
            skip_authorization=False,
        )
        # Validates redirect_uris against ALLOWED_REDIRECT_URI_SCHEMES.
        application.full_clean(exclude=["user", "client_secret"])
        application.save()
        return Response(
            {**serialize(application), "client_secret": client_secret},
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, pk):
        Application.objects.filter(pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
