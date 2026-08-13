# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Unit tests for provisioning the MCP OAuth application from the environment.

The command runs on every API start, so it has to be idempotent and it has to
leave the grants users already gave the application alone.
"""

import pytest
from django.contrib.auth.hashers import check_password
from django.core.management import call_command
from oauth2_provider.models import get_application_model

from plane.db.models import ApplicationInstallation, Workspace, WorkspaceMember

Application = get_application_model()

CLIENT_ID = "chart-provisioned-client-id"
CLIENT_SECRET = "chart-provisioned-client-secret"
URIS = "https://plane.example.com/mcp/http/auth/callback,https://plane.example.com/mcp/auth/callback"


@pytest.fixture
def provisioned(db, monkeypatch):
    def _provision(**overrides):
        env = {
            "PLANE_OAUTH_PROVIDER_CLIENT_ID": CLIENT_ID,
            "PLANE_OAUTH_PROVIDER_CLIENT_SECRET": CLIENT_SECRET,
            "MCP_OAUTH_REDIRECT_URIS": URIS,
            "MCP_OAUTH_APP_NAME": "Plane MCP",
            **overrides,
        }
        for key, value in env.items():
            monkeypatch.setenv(key, value)
        call_command("provision_oauth_application")
        return Application.objects.filter(client_id=CLIENT_ID).first()

    return _provision


@pytest.mark.unit
class TestProvisioning:
    @pytest.mark.django_db
    def test_creates_the_application(self, provisioned):
        application = provisioned()

        assert application is not None
        assert application.name == "Plane MCP"
        assert application.client_type == Application.CLIENT_CONFIDENTIAL
        assert application.authorization_grant_type == Application.GRANT_AUTHORIZATION_CODE

    @pytest.mark.django_db
    def test_both_callbacks_are_registered(self, provisioned):
        # One per line is how django-oauth-toolkit matches them.
        assert provisioned().redirect_uris.split("\n") == [
            "https://plane.example.com/mcp/http/auth/callback",
            "https://plane.example.com/mcp/auth/callback",
        ]

    @pytest.mark.django_db
    def test_the_secret_is_usable(self, provisioned):
        application = provisioned()

        assert check_password(CLIENT_SECRET, application.client_secret)

    @pytest.mark.django_db
    def test_consent_is_never_skipped(self, provisioned):
        assert provisioned().skip_authorization is False

    @pytest.mark.django_db
    def test_running_twice_writes_nothing(self, provisioned):
        first = provisioned()
        stamp = first.updated

        second = provisioned()

        assert Application.objects.count() == 1
        # It runs on every API start, so an unchanged deploy must not touch the row.
        assert second.client_secret == first.client_secret
        assert second.updated == stamp

    @pytest.mark.django_db
    def test_a_changed_host_updates_the_callbacks(self, provisioned):
        provisioned()

        application = provisioned(MCP_OAUTH_REDIRECT_URIS="https://moved.example.com/mcp/http/auth/callback")

        assert application.redirect_uris == "https://moved.example.com/mcp/http/auth/callback"

    @pytest.mark.django_db
    def test_a_rotated_secret_is_stored(self, provisioned):
        provisioned()

        application = provisioned(PLANE_OAUTH_PROVIDER_CLIENT_SECRET="rotated-secret")

        assert check_password("rotated-secret", application.client_secret)

    @pytest.mark.django_db
    def test_renaming_leaves_the_secret_alone(self, provisioned):
        first = provisioned()

        renamed = provisioned(MCP_OAUTH_APP_NAME="Renamed")

        # Rehashing an unchanged secret would invalidate nothing, but it is work
        # the deploy does not need to do.
        assert renamed.name == "Renamed"
        assert renamed.client_secret == first.client_secret

    @pytest.mark.django_db
    def test_existing_grants_survive_reprovisioning(self, provisioned, create_user):
        application = provisioned()
        workspace = Workspace.objects.create(name="Alpha", slug="alpha", owner=create_user)
        WorkspaceMember.objects.create(workspace=workspace, member=create_user, role=20)
        ApplicationInstallation.objects.create(application=application, workspace=workspace, user=create_user)

        provisioned(MCP_OAUTH_APP_NAME="Renamed")

        # Reprovisioning must not make users authorize the client again.
        assert ApplicationInstallation.objects.filter(application=application).count() == 1


@pytest.mark.unit
class TestProvisioningIsOptional:
    @pytest.mark.django_db
    def test_nothing_happens_without_credentials(self, db, monkeypatch):
        monkeypatch.delenv("PLANE_OAUTH_PROVIDER_CLIENT_ID", raising=False)
        monkeypatch.delenv("PLANE_OAUTH_PROVIDER_CLIENT_SECRET", raising=False)
        monkeypatch.delenv("MCP_OAUTH_REDIRECT_URIS", raising=False)

        call_command("provision_oauth_application")

        assert not Application.objects.exists()

    @pytest.mark.django_db
    def test_credentials_without_callbacks_are_refused(self, db, monkeypatch):
        # Half a configuration would register a client nobody can redirect to.
        monkeypatch.setenv("PLANE_OAUTH_PROVIDER_CLIENT_ID", CLIENT_ID)
        monkeypatch.setenv("PLANE_OAUTH_PROVIDER_CLIENT_SECRET", CLIENT_SECRET)
        monkeypatch.delenv("MCP_OAUTH_REDIRECT_URIS", raising=False)

        call_command("provision_oauth_application")

        assert not Application.objects.exists()
