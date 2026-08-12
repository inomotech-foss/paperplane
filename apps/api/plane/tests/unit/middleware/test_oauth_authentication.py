# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Unit tests for the OAuth provider: bearer authentication, consent, and the
app-installation endpoint.

The guarantee under test is that a token only reaches the workspaces its holder
selected on the consent screen.
"""

from datetime import timedelta
from urllib.parse import parse_qs, urlparse

import pytest
from django.utils import timezone
from oauth2_provider.models import get_access_token_model, get_application_model

from plane.db.models import ApplicationInstallation, Workspace, WorkspaceMember
from plane.utils.path_validator import validate_next_path

Application = get_application_model()
AccessToken = get_access_token_model()


@pytest.fixture
def oauth_application(db):
    return Application.objects.create(
        name="Plane MCP",
        client_type=Application.CLIENT_CONFIDENTIAL,
        authorization_grant_type=Application.GRANT_AUTHORIZATION_CODE,
        redirect_uris="https://mcp.example.com/auth/callback",
    )


@pytest.fixture
def make_workspace(db, create_user):
    def _make(slug):
        workspace = Workspace.objects.create(name=slug.title(), slug=slug, owner=create_user)
        WorkspaceMember.objects.create(workspace=workspace, member=create_user, role=20)
        return workspace

    return _make


@pytest.fixture
def bearer_client(api_client, create_user, oauth_application):
    AccessToken.objects.create(
        user=create_user,
        token="oauth-test-token",
        application=oauth_application,
        expires=timezone.now() + timedelta(hours=1),
        scope="read write",
    )
    api_client.credentials(HTTP_AUTHORIZATION="Bearer oauth-test-token")
    return api_client


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


def consent(consent_client, application, slugs, allow="Authorize"):
    return consent_client.post(
        "/auth/o/authorize-app/",
        {
            "client_id": application.client_id,
            "response_type": "code",
            "redirect_uri": "https://mcp.example.com/auth/callback",
            "scope": "read write",
            "state": "xyz",
            "code_challenge": "a" * 43,
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
