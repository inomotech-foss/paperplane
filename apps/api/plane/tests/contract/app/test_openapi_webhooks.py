# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The webhook endpoints accept what the OpenAPI schema documents."""

from unittest.mock import patch

import jsonschema
import pytest

from plane.tests.openapi import documented, no_tasks  # noqa: F401
from plane.tests.openapi import documented_query, documented_request

BASE = "/api/workspaces/{slug}/webhooks/"


def sent(route, method, body, **params):
    """The path for `route` after checking `body` against its documented request body."""
    documented_request(route, method, body)
    return route.format(**params), body


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.usefixtures("no_tasks")
@patch("plane.app.serializers.webhook.validate_url")
class TestWebhookRequests:
    def test_create_and_update(self, _validate_url, session_client, workspace):
        body = {"url": "https://hooks.example/x", "project": True, "issue": True, "is_active": True}
        url, body = sent(BASE, "post", body, slug=workspace.slug)
        hook = documented(session_client.post(url, body, format="json"), 201)
        assert hook["secret_key"]
        url, body = sent(
            BASE + "{pk}/", "patch", {"cycle": True, "is_active": False}, slug=workspace.slug, pk=hook["id"]
        )
        assert documented(session_client.patch(url, body, format="json"))["cycle"] is True
        with pytest.raises(jsonschema.ValidationError):
            documented_request(BASE + "{pk}/", "patch", {"is_internal": True})

    def test_query_parameters(self, _validate_url):
        assert documented_query(BASE, "get") == set()
        assert documented_query("/api/workspaces/{slug}/webhook-logs/{webhook_id}/", "get") == set()
