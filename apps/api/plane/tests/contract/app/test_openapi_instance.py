# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The instance admin endpoints document the bodies they read."""

import jsonschema
import pytest

from plane.license.models import InstanceConfiguration
from plane.tests.openapi import documented, documented_query, documented_request


def admin_request(route, method, body):
    return documented_request(route, method, body, surface="admin")


@pytest.mark.contract
def test_bodies():
    admin_request("/api/instances/", "patch", {"instance_name": "P", "is_telemetry_enabled": False})
    admin_request("/api/instances/configurations/", "patch", {"ENABLE_SIGNUP": "1", "SMTP_PASSWORD": None})
    admin_request("/api/instances/email-credentials-check/", "post", {"receiver_email": "ann@plane.so"})
    admin_request("/api/instances/oauth-applications/", "post", {"name": "A", "redirect_uris": "https://a.example/cb"})
    admin_request("/api/instances/oauth-applications/{pk}/", "patch", {"name": "B"})
    with pytest.raises(jsonschema.ValidationError):
        admin_request("/api/instances/", "patch", {"is_verified": True})
    with pytest.raises(jsonschema.ValidationError):
        admin_request("/api/instances/oauth-applications/", "post", {"name": "A"})
    for route in ("/api/instances/admins/", "/api/instances/configurations/", "/api/instances/oauth-applications/"):
        assert documented_query(route, "get", surface="admin") == set()


@pytest.mark.contract
@pytest.mark.django_db
def test_configuration_update(instance_admin_client):
    InstanceConfiguration.objects.create(key="ENABLE_SIGNUP", value="0", category="AUTHENTICATION")
    body = {"ENABLE_SIGNUP": "1"}
    rows = documented(
        instance_admin_client.patch("/api/instances/configurations/", body, format="json"), surface="admin"
    )
    assert rows[0]["value"] == "1"
