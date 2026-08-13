# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import transaction
from oauth2_provider.models import get_access_token_model, get_grant_model, get_refresh_token_model
from rest_framework import status
from rest_framework.response import Response

from plane.db.models import ApplicationInstallation

from .base import BaseAPIView

AccessToken = get_access_token_model()
RefreshToken = get_refresh_token_model()
Grant = get_grant_model()


class ConnectedAppEndpoint(BaseAPIView):
    """OAuth applications the signed-in user has granted access to.

    The consent screen is the only other place a grant can be narrowed, and it
    needs the application to drive it. This is where a user sees the whole list.
    """

    def get(self, request):
        installations = (
            ApplicationInstallation.objects.filter(user=request.user)
            .select_related("application", "workspace")
            .order_by("application__name", "workspace__name")
        )

        applications = {}
        for installation in installations:
            application = applications.setdefault(
                installation.application_id,
                {
                    "id": installation.application_id,
                    "name": installation.application.name,
                    "connected_at": installation.created_at,
                    "workspaces": [],
                },
            )
            # The listed date is when access was first given, not last widened.
            application["connected_at"] = min(application["connected_at"], installation.created_at)
            application["workspaces"].append(
                {
                    "id": str(installation.workspace_id),
                    "name": installation.workspace.name,
                    "slug": installation.workspace.slug,
                }
            )

        return Response(
            [
                {**application, "connected_at": application["connected_at"].isoformat()}
                for application in applications.values()
            ],
            status=status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        installations = ApplicationInstallation.objects.filter(user=request.user, application_id=pk)
        if not installations.exists():
            return Response({"error": "You have not connected this application"}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            installations.delete()
            # Dropping the installations alone would leave the token able to read
            # the workspaceless routes, so retire the credentials as well.
            for model in (RefreshToken, AccessToken, Grant):
                model.objects.filter(user=request.user, application_id=pk).delete()

        return Response(status=status.HTTP_204_NO_CONTENT)
