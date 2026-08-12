# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from urllib.parse import quote

from django.db import transaction
from django.shortcuts import redirect
from oauth2_provider.models import get_application_model
from oauth2_provider.views import AuthorizationView
from rest_framework.response import Response
from rest_framework.views import APIView

from plane.api.middleware.oauth_authentication import OAuthBearerAuthentication
from plane.authentication.utils.host import base_host
from plane.db.models import ApplicationInstallation, Workspace


def member_workspaces(user):
    """Workspaces the user is an active member of."""
    return Workspace.objects.filter(workspace_member__member=user, workspace_member__is_active=True).distinct()


class AuthorizeAppView(AuthorizationView):
    """Consent screen for an OAuth application.

    This runs in the browser against a normal Plane session, so whatever sign-in
    the instance is configured for applies here, SSO included. The user picks the
    workspaces the application may act in, and those become the installations
    that bound every token issued from this grant.
    """

    template_name = "oauth/authorize_app.html"

    def handle_no_permission(self):
        # The web app drives sign-in, and it takes next_path rather than Django's
        # ?next=, so send the user there and bring them back to consent after.
        next_path = quote(self.request.get_full_path())
        return redirect(f"{base_host(self.request, is_app=True)}/?next_path={next_path}")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["workspaces"] = member_workspaces(self.request.user)
        return context

    def form_valid(self, form):
        if not form.cleaned_data.get("allow"):
            return super().form_valid(form)

        slugs = set(self.request.POST.getlist("workspaces"))
        workspaces = list(member_workspaces(self.request.user).filter(slug__in=slugs))
        if not slugs or len(workspaces) != len(slugs):
            # Nothing picked, or a workspace the user is not a member of.
            form.add_error(None, "Select at least one workspace you are a member of.")
            return self.form_invalid(form)

        # Only record the grant once the authorization itself succeeded.
        response = super().form_valid(form)
        application = get_application_model().objects.get(client_id=form.cleaned_data["client_id"])
        with transaction.atomic():
            for workspace in workspaces:
                ApplicationInstallation.objects.get_or_create(
                    application=application, workspace=workspace, user=self.request.user
                )
        return response


class AppInstallationEndpoint(APIView):
    """Workspaces the bearer token may act in.

    Clients read this to learn which workspaces a token covers.
    """

    authentication_classes = [OAuthBearerAuthentication]

    def get(self, request):
        installations = (
            ApplicationInstallation.objects.filter(user=request.user, application_id=request.auth.application_id)
            .select_related("workspace")
            .order_by("workspace__name")
        )
        return Response(
            [
                {
                    "id": str(installation.id),
                    "application": str(installation.application_id),
                    "workspace_detail": {
                        "id": str(installation.workspace.id),
                        "name": installation.workspace.name,
                        "slug": installation.workspace.slug,
                    },
                }
                for installation in installations
            ]
        )
