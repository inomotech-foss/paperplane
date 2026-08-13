# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import os

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from oauth2_provider.generators import generate_client_secret
from oauth2_provider.models import get_application_model
from rest_framework import status
from rest_framework.response import Response

from plane.license.api.permissions import InstanceAdminPermission

from .base import BaseAPIView

Application = get_application_model()

MANAGED_ERROR = "This application is managed by the chart. Change it in your chart values."


def applications():
    # Deleting an application cascades to its installations, so the count is
    # what an admin needs to see before revoking one. Installations are soft
    # deleted, and a plain join would count the revoked ones too.
    return Application.objects.annotate(
        installation_count=Count("installations", filter=Q(installations__deleted_at__isnull=True))
    )


def is_managed(application):
    """Whether the chart owns this application and reinstates it on deploy."""
    provisioned = os.environ.get("PLANE_OAUTH_PROVIDER_CLIENT_ID", "").strip()
    return bool(provisioned) and application.client_id == provisioned


def serialize(application):
    return {
        "id": application.id,
        "name": application.name,
        "client_id": application.client_id,
        "redirect_uris": application.redirect_uris,
        "installations": getattr(application, "installation_count", 0),
        "managed": is_managed(application),
        "created": application.created.isoformat(),
    }


class InstanceOAuthApplicationEndpoint(BaseAPIView):
    """Register OAuth clients such as the MCP server.

    Client secrets are hashed on save, so the secret is returned once at
    creation and cannot be recovered afterwards.
    """

    permission_classes = [InstanceAdminPermission]

    def get(self, request):
        return Response(
            [serialize(application) for application in applications().order_by("name")],
            status=status.HTTP_200_OK,
        )

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

    def patch(self, request, pk):
        # Only the two fields an admin can sensibly change. client_id stays put,
        # so renaming or adding a redirect URI does not break a deployed client.
        application = get_object_or_404(Application, pk=pk)
        if is_managed(application):
            return Response({"error": MANAGED_ERROR}, status=status.HTTP_409_CONFLICT)
        for field in ("name", "redirect_uris"):
            if field in request.data:
                value = (request.data.get(field) or "").strip()
                if not value:
                    return Response({"error": f"{field} cannot be empty"}, status=status.HTTP_400_BAD_REQUEST)
                setattr(application, field, value)
        application.full_clean(exclude=["user", "client_secret"])
        application.save()
        return Response(serialize(applications().get(pk=pk)), status=status.HTTP_200_OK)

    def delete(self, request, pk):
        application = get_object_or_404(Application, pk=pk)
        if is_managed(application):
            return Response({"error": MANAGED_ERROR}, status=status.HTTP_409_CONFLICT)
        application.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
