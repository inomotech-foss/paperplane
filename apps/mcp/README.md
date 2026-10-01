# Plane MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server for
[Plane](https://plane.so). Gives an AI agent tools to read and manage projects,
work items, cycles, modules and more.

Vendored from [makeplane/plane-mcp-server](https://github.com/makeplane/plane-mcp-server) (MIT, see LICENSE) as a git subtree, and changed to match this fork's API. Sync with:

```bash
git subtree pull --prefix apps/mcp mcp-upstream <tag> --squash
```

Issues and contributions belong in this repository, not upstream.

Built on [FastMCP](https://github.com/jlowin/fastmcp) and the official
[`plane-sdk`](https://pypi.org/project/plane-sdk/).

- **19 tools**, one per Plane resource, covering 113 operations
- **Local or remote** — stdio, streamable HTTP, SSE
- **OAuth or API key** authentication

## Quick start

Get an API key from Plane: **Workspace Settings → API tokens**.

Add this to your MCP client's configuration:

```json
{
  "mcpServers": {
    "plane": {
      "command": "uvx",
      "args": ["plane-mcp-server", "stdio"],
      "env": {
        "PLANE_API_KEY": "<your-api-key>",
        "PLANE_WORKSPACE_SLUG": "<your-workspace-slug>"
      }
    }
  }
}
```

`uvx` needs no install step. Requires Python 3.10+.

For a self-hosted Plane, add `"PLANE_BASE_URL": "https://plane.example.com"`.

## Transports

### stdio — local

Runs as a subprocess of your MCP client. Configuration as shown above; needs
`PLANE_API_KEY` and `PLANE_WORKSPACE_SLUG`.

```bash
PLANE_API_KEY=... PLANE_WORKSPACE_SLUG=... uvx plane-mcp-server stdio
```

### HTTP with OAuth — hosted

`https://mcp.plane.so/http/mcp`

The OAuth flow is handled on connect; no credentials in your config. For clients
without native remote MCP support, bridge with `mcp-remote`:

```json
{
  "mcpServers": {
    "plane": {
      "command": "npx",
      "args": ["mcp-remote@latest", "https://mcp.plane.so/http/mcp"]
    }
  }
}
```

Requires Node.js 22+.

### HTTP with a personal access token — hosted

`https://mcp.plane.so/http/api-key/mcp`

| Header | Value |
|---|---|
| `Authorization` | `Bearer <PAT>` |
| `X-Workspace-slug` | `<workspace-slug>` |

```json
{
  "mcpServers": {
    "plane": {
      "command": "npx",
      "args": ["mcp-remote@latest", "https://mcp.plane.so/http/api-key/mcp"],
      "headers": {
        "Authorization": "Bearer <PAT>",
        "X-Workspace-slug": "<workspace-slug>"
      }
    }
  }
}
```

### SSE — deprecated

`https://mcp.plane.so/sse` is maintained for backward compatibility only. Use an
HTTP transport instead.

## Tools

The server advertises 19 tools, one per resource. Each takes an `action`
parameter that selects the operation:

```python
workitem(action="create", project_id=..., name="Fix login")
workitem(action="list", project_id=..., pql='state_group = "started"')
cycle(action="archive", project_id=..., cycle_id=...)
```

Every tool's description lists its actions with their required and optional
parameters, so the catalogue is self-documenting at call time.

**→ [Full tool and action reference](plane_mcp/tools/README.md)**

### Querying work items

The work item, cycle and module lists and the work item count accept **PQL**,
Plane's query language, as this fork's API parses it:

```python
workitem(action="list", project_id=..., pql='state_group = "started" AND priority = "urgent"')
workitem(action="list", project_id=..., pql='descendantOf("CUST-1") AND type = "Invoice" AND state = "Paid"')
workitem(action="count", pql='assignee = currentUser()', group_by="state_id")
```

Names resolve to ids on the server, custom properties are addressed as
`cf["<name or id>"]`, and `descendantOf()` walks the whole hierarchy below a
work item. Call `get_pql_reference` for the full syntax and worked examples.

### Upgrading from the per-operation tools

Earlier releases exposed one tool per API operation. **Existing integrations keep
working**: 103 of those 106 names still resolve to the consolidated tool, so a
saved prompt or script calling `create_work_item` or `list_cycles` needs no
change. They are no longer advertised, and they keep the parameter names they
shipped with (`work_item_id`, not `workitem_id`).

Three names chose between two operations with a parameter
(`manage_project_archive(archive=False)`), which one tool-and-action pair cannot
reproduce; calling one tells you its replacement. `get_pql_reference` is
unchanged.

## Configuration

### Authentication

| Variable | Required for | Purpose |
|---|---|---|
| `PLANE_API_KEY` | stdio | API key |
| `PLANE_WORKSPACE_SLUG` | stdio | Target workspace |
| `PLANE_BASE_URL` | optional | Plane API URL (default `https://api.plane.so`) |

The remote transports carry credentials in the connection — the OAuth flow or the
PAT headers — and need none of these.

Self-hosting the server itself:

| Variable | Purpose |
|---|---|
| `PLANE_INTERNAL_BASE_URL` | Internal URL for server-to-server calls, preferred over `PLANE_BASE_URL` |
| `REDIS_URL` | OAuth token storage as one connection URL (`redis://` or `rediss://` for TLS); wins over host/port |
| `REDIS_HOST` / `REDIS_PORT` | OAuth token storage; falls back to in-memory |
| `PLANE_OAUTH_PROVIDER_*` | OAuth client credentials and base URL |
| `MCP_PATH_PREFIX` | Path prefix for the HTTP routes, when mounted behind a proxy — `/plane` serves `/plane/http/mcp` |

### Workspaces

On the consent screen the user ticks which workspaces the client may reach, and the API refuses any other. When more than one is ticked, every tool takes an extra `workspace_slug` argument listing them, and the call acts in the one it names. With a single workspace the argument does not appear.

### OAuth redirect URIs

The OAuth transports validate each client's redirect URI against an allowlist.
Common clients (Cursor, VS Code, Claude.ai, ChatGPT connectors, localhost) are
allowed by default.

To onboard a new client without a release, append patterns:

```bash
export PLANE_OAUTH_ALLOWED_REDIRECT_URIS="https://newclient.com/cb,https://other.app/oauth/*"
```

`*` matches any port, path segment or subdomain. Keep the host pinned and
wildcard only the port or path.

### Logging

Structured JSON. Each tool call logs its name, duration, status and — when
available — an opaque user id and the workspace slug.

```bash
export LOG_USER_INFO=false    # also log the display name (PII);
export LOG_PAYLOADS=false    # keep request payloads out of logs; default true
```

Only the OAuth and PAT transports carry a display name; stdio is unaffected.

## Development

```bash
cd apps/mcp
uv sync --extra dev
```

Run the server against a workspace:

```bash
PLANE_API_KEY=... PLANE_WORKSPACE_SLUG=... uv run python -m plane_mcp stdio
uv run python -m plane_mcp http            # port 8211
```

Tests, format, lint:

```bash
uv run pytest --ignore=tests/test_integration.py   # no network or credentials needed
uv run ruff format .                               # line length 120
uv run ruff check .                                # rules E, F, I, UP, B
```

The suite runs fully offline — every action of every resource is
executed against a stand-in that binds each call against the genuine `plane-sdk`
signature. See [`plane_mcp/tools/README.md`](plane_mcp/tools/README.md#tests).

Live integration tests are skipped unless you point them at a running server:

```bash
export PLANE_TEST_API_KEY=... PLANE_TEST_WORKSPACE_SLUG=...
export PLANE_TEST_MCP_URL=http://localhost:8211    # optional; this is the default
uv run pytest tests/test_integration.py -v
```

They write real data to that workspace.

### Repository layout

| Path | Contents |
|---|---|
| `plane_mcp/__main__.py` | entry point; picks the transport from `argv[1]` |
| `plane_mcp/server.py` | one factory per transport |
| `plane_mcp/client.py` | resolves credentials into a `plane-sdk` client |
| `plane_mcp/auth/` | OAuth provider and header auth |
| `plane_mcp/workspace.py` | the per-call workspace choice |
| `plane_mcp/tools/` | the tool surface: one module per Plane resource |
| `plane_mcp/toolkit/` | shared building blocks for the tool surface |
| `plane_mcp/pql_reference.py` | PQL syntax reference served to models |

## License

MIT — see [LICENSE](LICENSE).
