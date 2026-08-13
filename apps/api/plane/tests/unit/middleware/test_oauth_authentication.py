# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Unit tests for the OAuth provider: bearer authentication, consent, and the
app-installation endpoint.

The guarantee under test is that a token only reaches the workspaces its holder
selected on the consent screen.
"""

import base64
import hashlib
from datetime import timedelta
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import pytest
from django.utils import timezone
from oauth2_provider.models import get_access_token_model, get_application_model

from plane.db.models import ApplicationInstallation, Workspace, WorkspaceMember
from plane.utils.path_validator import validate_next_path

Application = get_application_model()
AccessToken = get_access_token_model()

REDIRECT_URI = "https://mcp.example.com/auth/callback"


CLIENT_SECRET = "test-client-secret"


@pytest.fixture
def oauth_application(db):
    return Application.objects.create(
        name="Plane MCP",
        client_type=Application.CLIENT_CONFIDENTIAL,
        authorization_grant_type=Application.GRANT_AUTHORIZATION_CODE,
        redirect_uris=REDIRECT_URI,
        # Hashed on save, so the plaintext stays here for the token exchange.
        client_secret=CLIENT_SECRET,
    )


@pytest.fixture
def make_workspace(db, create_user):
    def _make(slug):
        workspace = Workspace.objects.create(name=slug.title(), slug=slug, owner=create_user)
        WorkspaceMember.objects.create(workspace=workspace, member=create_user, role=20)
        return workspace

    return _make


@pytest.fixture
def make_bearer_client(api_client, create_user, oauth_application):
    def _make(scope="read write"):
        token = AccessToken.objects.create(
            user=create_user,
            token=f"oauth-test-token-{scope.replace(' ', '-')}",
            application=oauth_application,
            expires=timezone.now() + timedelta(hours=1),
            scope=scope,
        )
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.token}")
        return api_client

    return _make


@pytest.fixture
def bearer_client(make_bearer_client):
    return make_bearer_client()


@pytest.mark.unit
class TestOAuthBearerAuthentication:
    @pytest.mark.django_db
    def test_granted_workspace_is_authenticated(self, bearer_client, create_user, oauth_application, make_workspace):
        workspace = make_workspace("granted")
        ApplicationInstallation.objects.create(application=oauth_application, workspace=workspace, user=create_user)

        response = bearer_client.get(f"/api/v1/workspaces/{workspace.slug}/projects/")

        assert response.status_code == 200

    @pytest.mark.django_db
    def test_workspace_outside_the_grant_is_rejected(self, bearer_client, make_workspace):
        # A workspace the user belongs to, but never granted to this application.
        workspace = make_workspace("ungranted")

        response = bearer_client.get(f"/api/v1/workspaces/{workspace.slug}/projects/")

        # 403 not 401: the token is valid, it just does not cover this workspace.
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_grant_for_one_workspace_does_not_reach_another(
        self, bearer_client, create_user, oauth_application, make_workspace
    ):
        granted = make_workspace("alpha")
        other = make_workspace("beta")
        ApplicationInstallation.objects.create(application=oauth_application, workspace=granted, user=create_user)

        assert bearer_client.get(f"/api/v1/workspaces/{granted.slug}/projects/").status_code == 200
        assert bearer_client.get(f"/api/v1/workspaces/{other.slug}/projects/").status_code == 403

    @pytest.mark.django_db
    def test_revoking_an_installation_revokes_access(
        self, bearer_client, create_user, oauth_application, make_workspace
    ):
        workspace = make_workspace("revoked")
        installation = ApplicationInstallation.objects.create(
            application=oauth_application, workspace=workspace, user=create_user
        )
        assert bearer_client.get(f"/api/v1/workspaces/{workspace.slug}/projects/").status_code == 200

        installation.delete()  # soft delete

        assert bearer_client.get(f"/api/v1/workspaces/{workspace.slug}/projects/").status_code == 403

    @pytest.mark.django_db
    def test_workspaceless_route_is_not_scoped(self, bearer_client):
        # users/me carries no workspace, and clients call it to verify a token.
        response = bearer_client.get("/api/v1/users/me/")

        assert response.status_code == 200


@pytest.mark.unit
class TestAppInstallationEndpoint:
    @pytest.mark.django_db
    def test_lists_every_granted_workspace(self, bearer_client, create_user, oauth_application, make_workspace):
        for slug in ("one", "two"):
            ApplicationInstallation.objects.create(
                application=oauth_application, workspace=make_workspace(slug), user=create_user
            )

        response = bearer_client.get("/auth/o/app-installation/")

        assert response.status_code == 200
        assert {row["workspace_detail"]["slug"] for row in response.json()} == {"one", "two"}

    @pytest.mark.django_db
    def test_excludes_workspaces_granted_to_another_application(
        self, bearer_client, create_user, oauth_application, make_workspace
    ):
        other_application = Application.objects.create(
            name="Something else",
            client_type=Application.CLIENT_CONFIDENTIAL,
            authorization_grant_type=Application.GRANT_AUTHORIZATION_CODE,
            redirect_uris="https://other.example.com/callback",
        )
        ApplicationInstallation.objects.create(
            application=oauth_application, workspace=make_workspace("mine"), user=create_user
        )
        ApplicationInstallation.objects.create(
            application=other_application, workspace=make_workspace("theirs"), user=create_user
        )

        response = bearer_client.get("/auth/o/app-installation/")

        assert [row["workspace_detail"]["slug"] for row in response.json()] == ["mine"]


@pytest.fixture
def consent_client(client, create_user):
    client.force_login(create_user)
    return client


def consent(consent_client, application, slugs, allow="Authorize", code_challenge="a" * 43):
    return consent_client.post(
        "/auth/o/authorize-app/",
        {
            "client_id": application.client_id,
            "response_type": "code",
            "redirect_uri": REDIRECT_URI,
            "scope": "read write",
            "state": "xyz",
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "allow": allow,
            "workspaces": slugs,
        },
    )


@pytest.mark.unit
class TestConsent:
    @pytest.mark.django_db
    def test_selected_workspaces_become_installations(
        self, consent_client, create_user, oauth_application, make_workspace
    ):
        make_workspace("picked")
        make_workspace("skipped")

        response = consent(consent_client, oauth_application, ["picked"])

        assert "code=" in response["Location"]
        assert set(
            ApplicationInstallation.objects.filter(user=create_user).values_list("workspace__slug", flat=True)
        ) == {"picked"}

    @pytest.mark.django_db
    def test_unticking_a_workspace_revokes_it(self, consent_client, create_user, oauth_application, make_workspace):
        make_workspace("kept")
        make_workspace("dropped")
        consent(consent_client, oauth_application, ["kept", "dropped"])

        # A narrower selection must shrink the grant.
        consent(consent_client, oauth_application, ["kept"])

        assert set(
            ApplicationInstallation.objects.filter(user=create_user).values_list("workspace__slug", flat=True)
        ) == {"kept"}

    @pytest.mark.django_db
    def test_a_failed_authorization_records_nothing(
        self, consent_client, create_user, oauth_application, make_workspace
    ):
        make_workspace("nope")

        # An unregistered redirect_uri fails authorization; DOT returns an error
        # response rather than raising.
        response = consent_client.post(
            "/auth/o/authorize-app/",
            {
                "client_id": oauth_application.client_id,
                "response_type": "code",
                "redirect_uri": "https://attacker.example.com/callback",
                "scope": "read write",
                "state": "xyz",
                "code_challenge": "a" * 43,
                "code_challenge_method": "S256",
                "allow": "Authorize",
                "workspaces": ["nope"],
            },
        )

        assert "code=" not in response.get("Location", "")
        assert not ApplicationInstallation.objects.filter(user=create_user).exists()

    @pytest.mark.django_db
    def test_denying_records_nothing(self, consent_client, create_user, oauth_application, make_workspace):
        make_workspace("denied")

        consent(consent_client, oauth_application, ["denied"], allow="")

        assert not ApplicationInstallation.objects.filter(user=create_user).exists()


CODE_VERIFIER = "v" * 43
CODE_CHALLENGE = base64.urlsafe_b64encode(hashlib.sha256(CODE_VERIFIER.encode()).digest()).decode().rstrip("=")


def authorization_code(consent_client, application, slugs):
    response = consent(consent_client, application, slugs, code_challenge=CODE_CHALLENGE)
    return parse_qs(urlparse(response["Location"]).query)["code"][0]


def exchange(client, application, code, code_verifier=CODE_VERIFIER):
    return client.post(
        "/auth/o/token/",
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "client_id": application.client_id,
            "client_secret": CLIENT_SECRET,
            "code_verifier": code_verifier,
        },
    )


@pytest.mark.unit
class TestTokenExchange:
    """The half of the flow between consent and a usable bearer token.

    An MCP client drives this without a browser, so a misconfiguration here only
    shows up against a real client.
    """

    @pytest.mark.django_db
    def test_a_code_becomes_a_token_that_reaches_the_granted_workspace(
        self, client, consent_client, api_client, oauth_application, make_workspace
    ):
        workspace = make_workspace("granted")
        code = authorization_code(consent_client, oauth_application, [workspace.slug])

        response = exchange(client, oauth_application, code)

        assert response.status_code == 200
        payload = response.json()
        assert payload["token_type"] == "Bearer"
        assert payload["refresh_token"]
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {payload['access_token']}")
        assert api_client.get(f"/api/v1/workspaces/{workspace.slug}/projects/").status_code == 200

    @pytest.mark.django_db
    def test_the_token_stops_at_the_workspaces_that_were_ticked(
        self, client, consent_client, api_client, oauth_application, make_workspace
    ):
        granted = make_workspace("picked")
        skipped = make_workspace("unpicked")
        code = authorization_code(consent_client, oauth_application, [granted.slug])

        token = exchange(client, oauth_application, code).json()["access_token"]

        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        assert api_client.get(f"/api/v1/workspaces/{skipped.slug}/projects/").status_code == 403

    @pytest.mark.django_db
    def test_the_wrong_code_verifier_is_refused(self, client, consent_client, oauth_application, make_workspace):
        make_workspace("pkce")
        code = authorization_code(consent_client, oauth_application, ["pkce"])

        response = exchange(client, oauth_application, code, code_verifier="w" * 43)

        assert response.status_code == 400

    @pytest.mark.django_db
    def test_a_code_cannot_be_exchanged_twice(self, client, consent_client, oauth_application, make_workspace):
        make_workspace("replay")
        code = authorization_code(consent_client, oauth_application, ["replay"])
        exchange(client, oauth_application, code)

        response = exchange(client, oauth_application, code)

        assert response.status_code == 400

    @pytest.mark.django_db
    def test_a_refreshed_token_keeps_the_grant(
        self, client, consent_client, api_client, oauth_application, make_workspace
    ):
        workspace = make_workspace("refreshed")
        code = authorization_code(consent_client, oauth_application, [workspace.slug])
        refresh_token = exchange(client, oauth_application, code).json()["refresh_token"]

        response = client.post(
            "/auth/o/token/",
            {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": oauth_application.client_id,
                "client_secret": CLIENT_SECRET,
            },
        )

        assert response.status_code == 200
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access_token']}")
        assert api_client.get(f"/api/v1/workspaces/{workspace.slug}/projects/").status_code == 200


AUTHORIZE_URL = (
    "/auth/o/authorize-app/?response_type=code&client_id=abc123"
    "&redirect_uri=https%3A%2F%2Fmcp.example.com%2Fcallback&scope=read+write&state=xyz"
)


@pytest.mark.unit
class TestConsentSignInRedirect:
    @pytest.mark.django_db
    def test_the_full_authorize_url_would_not_survive_the_round_trip(self):
        # Why the session handoff exists: validate_next_path rejects the %2F%2F
        # in an encoded redirect_uri.
        assert validate_next_path(AUTHORIZE_URL) == ""

    @pytest.mark.django_db
    def test_signed_out_user_is_sent_to_sign_in_with_a_path_that_survives(self, client):
        response = client.get(AUTHORIZE_URL)

        assert response.status_code == 302
        next_path = parse_qs(urlparse(response["Location"]).query)["next_path"][0]
        assert validate_next_path(next_path) == next_path
        assert not urlparse(next_path).scheme
        assert not urlparse(next_path).netloc

    @pytest.mark.django_db
    def test_resume_returns_the_user_to_the_consent_screen(self, client, create_user):
        client.get(AUTHORIZE_URL)  # stores the pending authorization while signed out
        client.force_login(create_user)

        response = client.get("/auth/o/resume-authorize/")

        assert response.status_code == 302
        assert response["Location"] == AUTHORIZE_URL

    @pytest.mark.django_db
    def test_resume_without_a_pending_authorization_goes_somewhere_that_exists(self, client, create_user):
        client.force_login(create_user)

        response = client.get("/auth/o/resume-authorize/")

        assert response.status_code == 302
        assert "/auth/o/" not in response["Location"]

    @pytest.mark.django_db
    def test_resume_is_single_use(self, client, create_user):
        client.get(AUTHORIZE_URL)
        client.force_login(create_user)
        client.get("/auth/o/resume-authorize/")

        # The path is popped, so a replay cannot re-drive consent.
        response = client.get("/auth/o/resume-authorize/")

        assert "/auth/o/" not in response["Location"]


@pytest.mark.unit
class TestOAuthScopes:
    @pytest.mark.django_db
    def test_read_scope_allows_reads(self, make_bearer_client, create_user, oauth_application, make_workspace):
        workspace = make_workspace("readable")
        ApplicationInstallation.objects.create(application=oauth_application, workspace=workspace, user=create_user)

        response = make_bearer_client("read").get(f"/api/v1/workspaces/{workspace.slug}/projects/")

        assert response.status_code == 200

    @pytest.mark.django_db
    def test_read_scope_refuses_writes(self, make_bearer_client, create_user, oauth_application, make_workspace):
        workspace = make_workspace("readonly")
        ApplicationInstallation.objects.create(application=oauth_application, workspace=workspace, user=create_user)

        response = make_bearer_client("read").post(
            f"/api/v1/workspaces/{workspace.slug}/projects/", {"name": "Nope", "identifier": "NOPE"}
        )

        assert response.status_code == 403

    @pytest.mark.django_db
    def test_write_scope_permits_writes(self, make_bearer_client, create_user, oauth_application, make_workspace):
        workspace = make_workspace("writable")
        ApplicationInstallation.objects.create(application=oauth_application, workspace=workspace, user=create_user)

        response = make_bearer_client("read write").post(
            f"/api/v1/workspaces/{workspace.slug}/projects/", {"name": "Yes", "identifier": "YES"}
        )

        # The payload may still be rejected on its merits; the scope must not be.
        assert response.status_code != 403

    @pytest.mark.django_db
    def test_api_key_requests_are_unaffected(self, api_key_client, create_user):
        # API keys carry no scopes; request.auth is the token string.
        response = api_key_client.get("/api/v1/users/me/")

        assert response.status_code == 200


@pytest.mark.unit
class TestOAuthRequestsReachTheAuditLog:
    """The middleware runs outside DRF, so the actor has to be handed to it."""

    @pytest.mark.django_db
    def test_a_granted_request_is_attributed(self, bearer_client, create_user, oauth_application, make_workspace):
        workspace = make_workspace("audited")
        ApplicationInstallation.objects.create(application=oauth_application, workspace=workspace, user=create_user)
        logged = []
        with patch("plane.middleware.logger.process_logs.delay", lambda log_data: logged.append(log_data)):
            bearer_client.get(f"/api/v1/workspaces/{workspace.slug}/projects/")

        assert [entry["token_identifier"] for entry in logged] == [f"oauth:{oauth_application.id}:{create_user.id}"]

    @pytest.mark.django_db
    def test_a_refused_request_is_still_attributed(self, bearer_client, create_user, oauth_application, make_workspace):
        # A token reaching for a workspace it was never granted is exactly what
        # an audit log exists to show.
        workspace = make_workspace("offlimits")
        logged = []
        with patch("plane.middleware.logger.process_logs.delay", lambda log_data: logged.append(log_data)):
            response = bearer_client.get(f"/api/v1/workspaces/{workspace.slug}/projects/")

        assert response.status_code == 403
        assert logged[0]["token_identifier"] == f"oauth:{oauth_application.id}:{create_user.id}"
        assert logged[0]["response_code"] == 403

    @pytest.mark.django_db
    def test_session_requests_are_not_logged(self, session_client, create_user):
        logged = []
        with patch("plane.middleware.logger.process_logs.delay", lambda log_data: logged.append(log_data)):
            session_client.get("/api/v1/users/me/")

        # The log is for external API traffic, not the web app.
        assert logged == []


@pytest.mark.unit
class TestWorkspacelessRoutesFailClosed:
    @pytest.mark.django_db
    def test_every_v1_route_carries_a_slug_or_is_allowlisted(self):
        # The scoping guarantee holds only because every v1 route names its
        # workspace. A new one that does not must be a deliberate addition to
        # WORKSPACELESS_VIEWS, not a silent exemption.
        from django.urls import get_resolver
        from django.urls.resolvers import URLResolver

        from plane.api.middleware.oauth_authentication import WORKSPACELESS_VIEWS

        patterns = []

        def walk(resolver, prefix=""):
            for entry in resolver.url_patterns:
                if isinstance(entry, URLResolver):
                    walk(entry, prefix + str(entry.pattern))
                else:
                    patterns.append((prefix + str(entry.pattern), entry.name))

        walk(get_resolver())

        unscoped = [
            (pattern, name)
            for pattern, name in patterns
            if pattern.startswith("api/v1/") and "<str:slug>" not in pattern and name not in WORKSPACELESS_VIEWS
        ]

        assert unscoped == []

    @pytest.mark.django_db
    def test_a_route_outside_the_allowlist_is_refused(self, bearer_client, monkeypatch):
        from plane.api.middleware import oauth_authentication

        # users/me is only reachable because it is allowlisted.
        monkeypatch.setattr(oauth_authentication, "WORKSPACELESS_VIEWS", frozenset())

        response = bearer_client.get("/api/v1/users/me/")

        assert response.status_code == 403
