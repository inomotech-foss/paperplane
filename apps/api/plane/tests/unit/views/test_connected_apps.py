# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Unit tests for the connected applications a user can see and revoke.

Revoking here has to be as complete as an admin deleting the application: the
grant goes and so do the credentials issued against it.
"""

from datetime import timedelta

import pytest
from django.utils import timezone
from oauth2_provider.models import get_access_token_model, get_application_model, get_refresh_token_model

from plane.db.models import ApplicationInstallation, User, Workspace, WorkspaceMember

Application = get_application_model()
AccessToken = get_access_token_model()
RefreshToken = get_refresh_token_model()

URL = "/api/users/connected-apps/"


@pytest.fixture
def application(db):
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
def install(db, create_user, application):
    def _install(workspace, user=None):
        return ApplicationInstallation.objects.create(
            application=application, workspace=workspace, user=user or create_user
        )

    return _install


@pytest.mark.unit
class TestListingConnectedApps:
    @pytest.mark.django_db
    def test_an_application_carries_every_workspace_it_reaches(
        self, session_client, application, make_workspace, install
    ):
        install(make_workspace("alpha"))
        install(make_workspace("beta"))

        response = session_client.get(URL)

        assert response.status_code == 200
        assert len(response.json()) == 1
        row = response.json()[0]
        assert row["name"] == "Plane MCP"
        assert [workspace["slug"] for workspace in row["workspaces"]] == ["alpha", "beta"]

    @pytest.mark.django_db
    def test_nothing_connected_is_an_empty_list(self, session_client):
        assert session_client.get(URL).json() == []

    @pytest.mark.django_db
    def test_another_users_grant_is_not_listed(self, session_client, application, make_workspace, install):
        other = User.objects.create(email="other@example.com", username="other")
        workspace = make_workspace("theirs")
        WorkspaceMember.objects.create(workspace=workspace, member=other, role=20)
        install(workspace, user=other)

        assert session_client.get(URL).json() == []

    @pytest.mark.django_db
    def test_a_revoked_installation_is_not_listed(self, session_client, make_workspace, install):
        install(make_workspace("gone")).delete()  # soft delete

        assert session_client.get(URL).json() == []


@pytest.mark.unit
class TestRevokingAConnectedApp:
    @pytest.mark.django_db
    def test_revoking_drops_every_workspace(self, session_client, application, make_workspace, install):
        install(make_workspace("alpha"))
        install(make_workspace("beta"))

        response = session_client.delete(f"{URL}{application.id}/")

        assert response.status_code == 204
        assert session_client.get(URL).json() == []

    @pytest.mark.django_db
    def test_revoking_retires_the_tokens(self, session_client, create_user, application, make_workspace, install):
        install(make_workspace("alpha"))
        access = AccessToken.objects.create(
            user=create_user,
            token="connected-app-token",
            application=application,
            expires=timezone.now() + timedelta(hours=1),
            scope="read write",
        )
        RefreshToken.objects.create(
            user=create_user, token="connected-app-refresh", application=application, access_token=access
        )

        session_client.delete(f"{URL}{application.id}/")

        # Dropping the grant alone would leave the token good for users/me.
        assert not AccessToken.objects.filter(user=create_user, application=application).exists()
        assert not RefreshToken.objects.filter(user=create_user, application=application).exists()

    @pytest.mark.django_db
    def test_revoking_leaves_another_users_grant_alone(
        self, session_client, application, make_workspace, install, create_user
    ):
        other = User.objects.create(email="other@example.com", username="other")
        workspace = make_workspace("shared")
        WorkspaceMember.objects.create(workspace=workspace, member=other, role=20)
        install(workspace)
        install(workspace, user=other)

        session_client.delete(f"{URL}{application.id}/")

        assert ApplicationInstallation.objects.filter(user=other, application=application).exists()

    @pytest.mark.django_db
    def test_revoking_something_not_connected(self, session_client, application):
        assert session_client.delete(f"{URL}{application.id}/").status_code == 404

    @pytest.mark.django_db
    def test_an_anonymous_caller_sees_nothing(self, api_client):
        assert api_client.get(URL).status_code in (401, 403)
