"""The connected workspace.

Upstream also reads and writes workspace feature flags here; this fork has no
workspace features endpoint, so only the credential-bound view remains.
"""

from __future__ import annotations

from typing import Any

from fastmcp import FastMCP

from plane_mcp.client import current_workspace
from plane_mcp.toolkit import Action, build_annotations, build_description

NAME = "workspace"
TITLE = "Workspace"

ACTIONS = (
    Action(
        "retrieve",
        note="the workspace this call acts in: slug, id, name and how it connected. "
        "id and name are known only on an OAuth connection and are null otherwise. "
        "This tool has no action parameter",
        read=True,
    ),
)

LEGACY: dict[str, str] = {}


def register(mcp: FastMCP) -> None:
    @mcp.tool(
        name=NAME,
        description=build_description("The connected workspace.", ACTIONS),
        annotations=build_annotations(TITLE, ACTIONS),
    )
    def workspace() -> dict[str, Any]:
        return current_workspace()
