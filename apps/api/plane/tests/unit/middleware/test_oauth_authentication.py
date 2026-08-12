# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Unit tests for OAuthBearerAuthentication and the app-installation endpoint.

The guarantee under test is that an OAuth token only reaches the workspaces its
holder picked on the consent screen. The workspace comes from the URL, so a
client cannot widen its own access by asking for a different slug.
"""

from datetime import timedelta

import pytest
from django.utils import timezone
from oauth2_provider.models import get_access_token_model, get_application_model

from plane.db.models import ApplicationInstallation, Workspace, WorkspaceMember

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

        # 403 rather than 401: the token is valid, so re-authenticating with the
        # same grant changes nothing. The user has to consent for this workspace.
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
