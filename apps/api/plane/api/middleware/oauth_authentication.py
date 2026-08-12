# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from oauth2_provider.contrib.rest_framework import OAuth2Authentication
from rest_framework.exceptions import AuthenticationFailed

from plane.db.models import ApplicationInstallation


class OAuthBearerAuthentication(OAuth2Authentication):
    """Authenticate an OAuth bearer token within its granted workspaces.

    The workspace comes from the URL rather than from the client. Routes without
    one, such as users/me, are not scoped.
    """

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        user, token = result
        resolver_match = getattr(request, "resolver_match", None)
        slug = resolver_match.kwargs.get("slug") if resolver_match else None
        if slug and not self.is_installed(user, token, slug):
            raise AuthenticationFailed("This authorization does not cover the requested workspace")
        return user, token

    def is_installed(self, user, token, slug):
        application_id = getattr(token, "application_id", None)
        if not application_id:
            return False
        return ApplicationInstallation.objects.filter(
            user=user, application_id=application_id, workspace__slug=slug
        ).exists()
