"""The upstream token must not be bound to this server's URL.

Plane's API is a different resource from this server, so an RFC 8707 resource
indicator forwarded to Plane yields a token Plane refuses at its own API.
"""

from urllib.parse import parse_qs, urlparse

import pytest
from key_value.aio.stores.memory import MemoryStore

from plane_mcp.auth import PlaneOAuthProvider


@pytest.fixture
def provider():
    return PlaneOAuthProvider(
        client_id="test-client-id",
        client_secret="test-client-secret",
        base_url="http://localhost:8211",
        plane_base_url="http://localhost:9999",
        plane_internal_base_url="http://localhost:9999",
        client_storage=MemoryStore(),
        required_scopes=["read", "write"],
        require_authorization_consent=False,
    )


def test_resource_indicator_is_not_forwarded(provider):
    url = provider._build_upstream_authorize_url("txn-1", {"resource": "http://localhost:8211/mcp"})
    assert "resource" not in parse_qs(urlparse(url).query)
