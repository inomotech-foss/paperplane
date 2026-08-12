# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Unit tests for registering OAuth applications as an instance admin.
"""

import pytest
from django.utils import timezone
from oauth2_provider.models import get_application_model

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
