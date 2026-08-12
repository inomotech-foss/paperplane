# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from oauth2_provider.contrib.rest_framework import OAuth2Authentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import SAFE_METHODS

from plane.db.models import ApplicationInstallation

# Routes reachable by an OAuth token without naming a workspace. All of them are
# scoped to the requesting user. Anything else must carry a workspace slug, so a
# new route is refused until someone decides which of the two it is.
WORKSPACELESS_VIEWS = frozenset(
    {
        "users",
        "user-assets",
        "user-assets-detail",
        "user-server-assets",
        "user-server-assets-detail",
        "oauth-app-installation",
    }
)


class OAuthBearerAuthentication(OAuth2Authentication):
    """Authenticate an OAuth bearer token within its granted workspaces.

    The workspace comes from the URL rather than from the client, and a route
    that names no workspace is refused unless it is in WORKSPACELESS_VIEWS.
    """

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        user, token = result
        # Scopes are checked here rather than in a permission class because 58 of
        # the v1 views replace permission_classes outright, while none replace
        # authentication_classes.
        required_scope = "read" if request.method in SAFE_METHODS else "write"
        if not token.allow_scopes([required_scope]):
            raise AuthenticationFailed(f"This token does not carry the {required_scope} scope")

        resolver_match = getattr(request, "resolver_match", None)
        slug = resolver_match.kwargs.get("slug") if resolver_match else None
        if slug:
            if not self.is_installed(user, token, slug):
                raise AuthenticationFailed("This authorization does not cover the requested workspace")
        elif not resolver_match or resolver_match.url_name not in WORKSPACELESS_VIEWS:
            raise AuthenticationFailed("This route is not available to OAuth tokens")
        return user, token

    def is_installed(self, user, token, slug):
        application_id = getattr(token, "application_id", None)
        if not application_id:
            return False
        return ApplicationInstallation.objects.filter(
            user=user, application_id=application_id, workspace__slug=slug
        ).exists()
