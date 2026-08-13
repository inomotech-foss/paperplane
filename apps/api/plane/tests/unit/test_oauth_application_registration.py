# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Unit tests for registering OAuth applications as an instance admin.
"""

import pytest
from django.utils import timezone
from oauth2_provider.models import get_application_model

from plane.db.models import ApplicationInstallation, Workspace, WorkspaceMember
from plane.license.models import Instance, InstanceAdmin

Application = get_application_model()

URL = "/api/instances/oauth-applications/"


@pytest.fixture
def admin_client(api_client, create_user):
    instance = Instance.objects.create(
        instance_name="test",
        instance_id="test",
        current_version="1",
        latest_version="1",
        last_checked_at=timezone.now(),
    )
    InstanceAdmin.objects.create(instance=instance, user=create_user, role=20)
    api_client.force_authenticate(user=create_user)
    return api_client


@pytest.mark.unit
class TestOAuthApplicationRegistration:
    @pytest.mark.django_db
    def test_creating_returns_the_secret_once(self, admin_client):
        response = admin_client.post(
            URL, {"name": "Plane MCP", "redirect_uris": "https://mcp.example.com/auth/callback"}
        )

        assert response.status_code == 201
        secret = response.json()["client_secret"]
        assert secret
        # Stored hashed, so the listing cannot hand it out again.
        assert Application.objects.get(client_id=response.json()["client_id"]).client_secret != secret
        assert "client_secret" not in admin_client.get(URL).json()[0]

    @pytest.mark.django_db
    def test_consent_is_never_skipped(self, admin_client):
        # skip_authorization would issue a token with no installations, which
        # then fails on every workspace route.
        response = admin_client.post(
            URL,
            {
                "name": "Sneaky",
                "redirect_uris": "https://mcp.example.com/auth/callback",
                "skip_authorization": True,
            },
        )

        assert Application.objects.get(client_id=response.json()["client_id"]).skip_authorization is False

    @pytest.mark.django_db
    def test_a_redirect_uri_with_an_unsupported_scheme_is_refused(self, admin_client):
        response = admin_client.post(URL, {"name": "Bad", "redirect_uris": "ftp://mcp.example.com/callback"})

        assert response.status_code == 400
        assert not Application.objects.exists()

    @pytest.mark.django_db
    def test_name_and_redirect_uris_are_required(self, admin_client):
        assert admin_client.post(URL, {"name": "No URIs"}).status_code == 400

    @pytest.mark.django_db
    def test_a_non_admin_cannot_register_anything(self, api_client, create_user):
        api_client.force_authenticate(user=create_user)

        response = api_client.post(URL, {"name": "Nope", "redirect_uris": "https://example.com/cb"})

        assert response.status_code == 403
        assert not Application.objects.exists()


@pytest.fixture
def registered(admin_client):
    response = admin_client.post(URL, {"name": "Plane MCP", "redirect_uris": "https://mcp.example.com/auth/callback"})
    return response.json()


@pytest.mark.unit
class TestEditingAnApplication:
    @pytest.mark.django_db
    def test_renaming_keeps_the_client_id(self, admin_client, registered):
        # A new client_id would break every deployed client, so editing has to
        # be possible without delete and recreate.
        response = admin_client.patch(f"{URL}{registered['id']}/", {"name": "Renamed"})

        assert response.status_code == 200
        assert response.json()["name"] == "Renamed"
        assert response.json()["client_id"] == registered["client_id"]

    @pytest.mark.django_db
    def test_adding_a_redirect_uri(self, admin_client, registered):
        uris = f"{registered['redirect_uris']}\nhttps://mcp.example.com/other/callback"

        response = admin_client.patch(f"{URL}{registered['id']}/", {"redirect_uris": uris})

        assert response.status_code == 200
        assert Application.objects.get(pk=registered["id"]).redirect_uris == uris

    @pytest.mark.django_db
    def test_an_unsupported_scheme_is_still_refused(self, admin_client, registered):
        response = admin_client.patch(f"{URL}{registered['id']}/", {"redirect_uris": "ftp://mcp.example.com/cb"})

        assert response.status_code == 400

    @pytest.mark.django_db
    def test_editing_something_that_does_not_exist(self, admin_client):
        assert admin_client.patch(f"{URL}999/", {"name": "Ghost"}).status_code == 404

    @pytest.mark.django_db
    def test_revoking_something_that_does_not_exist(self, admin_client):
        # 204 either way would tell the UI a revoke succeeded when nothing went.
        assert admin_client.delete(f"{URL}999/").status_code == 404


@pytest.mark.unit
class TestInstallationCount:
    @pytest.mark.django_db
    def test_counts_the_users_who_granted_the_application(self, admin_client, create_user, registered):
        # Revoking an application cascades to its installations, so the admin
        # needs to see how many grants that would take with it.
        application = Application.objects.get(pk=registered["id"])
        workspace = Workspace.objects.create(name="Alpha", slug="alpha", owner=create_user)
        WorkspaceMember.objects.create(workspace=workspace, member=create_user, role=20)
        ApplicationInstallation.objects.create(application=application, workspace=workspace, user=create_user)

        assert admin_client.get(URL).json()[0]["installations"] == 1

    @pytest.mark.django_db
    def test_a_revoked_installation_stops_counting(self, admin_client, create_user, registered):
        application = Application.objects.get(pk=registered["id"])
        workspace = Workspace.objects.create(name="Beta", slug="beta", owner=create_user)
        WorkspaceMember.objects.create(workspace=workspace, member=create_user, role=20)
        installation = ApplicationInstallation.objects.create(
            application=application, workspace=workspace, user=create_user
        )

        installation.delete()  # soft delete

        assert admin_client.get(URL).json()[0]["installations"] == 0
