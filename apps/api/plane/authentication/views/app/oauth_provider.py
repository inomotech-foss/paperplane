# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from urllib.parse import parse_qs, urlparse

from django.db import transaction
from django.shortcuts import redirect
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme, urlencode
from django.views import View
from oauth2_provider.models import get_application_model
from oauth2_provider.views import AuthorizationView
from rest_framework.response import Response
from rest_framework.views import APIView

from plane.api.middleware.oauth_authentication import OAuthBearerAuthentication
from plane.authentication.utils.host import base_host
from plane.db.models import ApplicationInstallation, Workspace

# Where the pending authorize URL waits while the user signs in.
AUTHORIZE_PATH_SESSION_KEY = "oauth_authorize_path"


def member_workspaces(user):
    """Workspaces the user is an active member of."""
    return Workspace.objects.filter(workspace_member__member=user, workspace_member__is_active=True).distinct()


def authorization_succeeded(response):
    """Whether the authorization response actually carries a grant.

    django-oauth-toolkit returns an error response instead of raising, and that
    error is itself usually a redirect back to the client, so the type of the
    response says nothing. Only the absence of an OAuth error does.
    """
    location = response.headers.get("Location") if hasattr(response, "headers") else None
    if not location:
        # A fatal client error renders a page rather than redirecting.
        return False
    return "error" not in parse_qs(urlparse(location).query)


class AuthorizeAppView(AuthorizationView):
    """Consent screen for an OAuth application.

    This runs in the browser against a normal Plane session, so whatever sign-in
    the instance is configured for applies here, SSO included. The user picks the
    workspaces the application may act in, and those become the installations
    that bound every token issued from this grant.
    """

    template_name = "oauth/authorize_app.html"

    def handle_no_permission(self):
        # Sign-in happens in the web app, which round-trips the return path through
        # next_path. A full authorize URL does not survive that trip: the shared
        # validator rejects the %2F%2F inside an encoded redirect_uri, and the
        # redirect builder re-joins parts on & without encoding, so everything
        # after the first parameter is lost. Send a bare path instead and keep the
        # real one in the session, which login() carries over via cycle_key().
        self.request.session[AUTHORIZE_PATH_SESSION_KEY] = self.request.get_full_path()
        resume_path = reverse("oauth-resume-authorize")
        return redirect(f"{base_host(self.request, is_app=True)}/?{urlencode({'next_path': resume_path})}")

    def get(self, request, *args, **kwargs):
        # approval_prompt=auto lets a client reissue a token without showing the
        # consent screen. That screen is the only place the workspace selection is
        # made, so it is not the client's to skip.
        if request.GET.get("approval_prompt") != "force":
            params = request.GET.copy()
            params["approval_prompt"] = "force"
            request.GET = params
        return super().get(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["workspaces"] = member_workspaces(self.request.user)
        context["installed_slugs"] = set(
            self.installed_workspace_slugs(
                context.get("application") or self.application_from_form(context.get("form"))
            )
        )
        # Re-rendering after a validation error goes through FormView, which does
        # not carry the application through, and a consent screen that cannot name
        # what it is granting is worse than useless.
        if not context.get("application"):
            context["application"] = self.application_from_form(context.get("form"))
        return context

    def application_from_form(self, form):
        client_id = getattr(form, "data", {}).get("client_id") if form else None
        if not client_id:
            return None
        return get_application_model().objects.filter(client_id=client_id).first()

    def installed_workspace_slugs(self, application):
        if not application:
            return []
        return ApplicationInstallation.objects.filter(user=self.request.user, application=application).values_list(
            "workspace__slug", flat=True
        )

    def form_valid(self, form):
        if not form.cleaned_data.get("allow"):
            return super().form_valid(form)

        slugs = set(self.request.POST.getlist("workspaces"))
        workspaces = list(member_workspaces(self.request.user).filter(slug__in=slugs))
        if not slugs or len(workspaces) != len(slugs):
            # Nothing picked, or a workspace the user is not a member of.
            form.add_error(None, "Select at least one workspace you are a member of.")
            return self.form_invalid(form)

        response = super().form_valid(form)
        if not authorization_succeeded(response):
            # No grant was issued, so record nothing. Otherwise a rejected attempt
            # would leave installations behind and widen the next successful one.
            return response

        application = get_application_model().objects.get(client_id=form.cleaned_data["client_id"])
        with transaction.atomic():
            # Reconcile rather than append: unticking a workspace has to revoke it,
            # or the screen is lying about what the user is granting.
            ApplicationInstallation.objects.filter(user=self.request.user, application=application).exclude(
                workspace__in=workspaces
            ).delete()
            for workspace in workspaces:
                ApplicationInstallation.objects.get_or_create(
                    application=application, workspace=workspace, user=self.request.user
                )
        return response


class ResumeAuthorizeAppView(View):
    """Send a freshly signed-in user back to the consent screen they came from.

    The web app can only hand back a bare path, so the authorize query is picked
    up from the session here rather than from the URL.
    """

    def get(self, request):
        path = request.session.pop(AUTHORIZE_PATH_SESSION_KEY, "")
        authorize_path = reverse("oauth-authorize-app")
        # The stored value is one we wrote, but it reaches the browser as a
        # redirect, so re-check it rather than trusting the session round trip.
        if not path.startswith(authorize_path) or not url_has_allowed_host_and_scheme(path, allowed_hosts=None):
            # Nothing to resume. Consent is unreachable without the original
            # query, so send them somewhere that exists.
            return redirect(base_host(request, is_app=True))
        return redirect(path)


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
