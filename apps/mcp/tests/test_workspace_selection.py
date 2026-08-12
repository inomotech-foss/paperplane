"""Tests for picking a workspace when a token grants several."""

import asyncio

import httpx
import pytest
from fastmcp import Client, FastMCP
from fastmcp.exceptions import ToolError
from fastmcp.server.auth.auth import AccessToken

from plane_mcp import client as client_module
from plane_mcp import workspace as workspace_module
from plane_mcp.auth import plane_oauth_provider
from plane_mcp.middleware import WorkspaceSelectionMiddleware


def _grant(monkeypatch, *slugs):
    """Make the caller's token look installed in the given workspaces."""
    token = AccessToken(token="t", client_id="c", scopes=["read"], claims={"workspace_slugs": list(slugs)})
    monkeypatch.setattr(workspace_module, "get_access_token", lambda: token)


def _server(seen):
    mcp = FastMCP("test")
    mcp.add_middleware(WorkspaceSelectionMiddleware())

    @mcp.tool()
    def whoami() -> str:
        """Report the workspace this call resolved to."""
        seen.append(workspace_module.selected_workspace_slug())
        return seen[-1] or ""

    return mcp


def _with_server(seen, request):
    mcp = _server(seen)

    async def run():
        async with Client(mcp) as c:
            return await request(c)

    return asyncio.run(run())


def test_a_single_grant_leaves_the_tools_alone(monkeypatch):
    _grant(monkeypatch, "acme")
    seen = []

    tools = _with_server(seen, lambda c: c.list_tools())

    assert "workspace_slug" not in tools[0].inputSchema.get("properties", {})


def test_no_token_leaves_the_tools_alone(monkeypatch):
    _grant(monkeypatch)
    seen = []

    tools = _with_server(seen, lambda c: c.list_tools())

    assert "workspace_slug" not in tools[0].inputSchema.get("properties", {})


def test_several_grants_advertise_the_choice(monkeypatch):
    _grant(monkeypatch, "acme", "globex")
    seen = []

    tools = _with_server(seen, lambda c: c.list_tools())

    schema = tools[0].inputSchema
    assert schema["properties"]["workspace_slug"]["enum"] == ["acme", "globex"]
    assert "workspace_slug" in schema["required"]


def test_the_chosen_workspace_reaches_the_tool(monkeypatch):
    _grant(monkeypatch, "acme", "globex")
    seen = []

    _with_server(seen, lambda c: c.call_tool("whoami", {"workspace_slug": "globex"}))

    assert seen == ["globex"]


def test_the_selection_does_not_outlive_the_call(monkeypatch):
    _grant(monkeypatch, "acme", "globex")
    seen = []

    _with_server(seen, lambda c: c.call_tool("whoami", {"workspace_slug": "globex"}))

    assert workspace_module.selected_workspace_slug() is None


def test_choosing_is_required_once_there_are_several(monkeypatch):
    _grant(monkeypatch, "acme", "globex")
    seen = []

    with pytest.raises(ToolError, match="workspace_slug is required"):
        _with_server(seen, lambda c: c.call_tool("whoami", {}))

    assert seen == []


def test_an_ungranted_workspace_is_refused(monkeypatch):
    _grant(monkeypatch, "acme", "globex")
    seen = []

    with pytest.raises(ToolError, match="does not cover the workspace initech"):
        _with_server(seen, lambda c: c.call_tool("whoami", {"workspace_slug": "initech"}))

    assert seen == []


def test_a_single_grant_still_refuses_another_workspace(monkeypatch):
    """The argument is not advertised, but a client may send one anyway."""
    _grant(monkeypatch, "acme")
    seen = []

    with pytest.raises(ToolError, match="does not cover the workspace initech"):
        _with_server(seen, lambda c: c.call_tool("whoami", {"workspace_slug": "initech"}))


def _verify(monkeypatch, installations, status_code=200):
    def handler(request):
        if request.url.path.endswith("/users/me/"):
            return httpx.Response(200, json={"id": "u-1", "email": "a@example.com", "display_name": "A"})
        return httpx.Response(status_code, json=installations)

    real = httpx.AsyncClient
    monkeypatch.setattr(
        httpx, "AsyncClient", lambda *a, **kw: real(*a, **{**kw, "transport": httpx.MockTransport(handler)})
    )
    verifier = plane_oauth_provider.PlaneOAuthTokenVerifier(plane_base_url="http://plane")
    return asyncio.run(verifier.verify_token("t"))


def test_every_installation_is_recorded(monkeypatch):
    token = _verify(
        monkeypatch,
        [
            {"workspace_detail": {"slug": "acme", "name": "Acme", "id": "w-1"}},
            {"workspace_detail": {"slug": "globex", "name": "Globex", "id": "w-2"}},
        ],
    )

    assert token.claims["workspace_slugs"] == ["acme", "globex"]
    # Ambiguous with several, so nothing may quietly default to the first.
    assert token.claims["workspace_slug"] is None


def test_a_lone_installation_needs_no_choice(monkeypatch):
    token = _verify(monkeypatch, [{"workspace_detail": {"slug": "acme", "name": "Acme", "id": "w-1"}}])

    assert token.claims["workspace_slug"] == "acme"


def test_a_token_reaching_no_workspace_is_rejected(monkeypatch):
    assert _verify(monkeypatch, []) is None


def test_an_unreadable_installation_list_is_rejected(monkeypatch):
    assert _verify(monkeypatch, {"error": "nope"}, status_code=403) is None


def test_the_client_context_follows_the_selection(monkeypatch):
    token = AccessToken(
        token="t",
        client_id="c",
        scopes=["read"],
        claims={"auth_method": "oauth", "workspace_slug": None, "workspace_slugs": ["acme", "globex"]},
    )
    monkeypatch.setattr(client_module, "get_access_token", lambda: token)

    with workspace_module.selected_workspace("globex"):
        assert client_module.get_plane_client_context().workspace_slug == "globex"
