"""Workspace selection for a token that grants more than one."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar

from fastmcp.server.dependencies import get_access_token

WORKSPACE_SLUG_ARGUMENT = "workspace_slug"

_selected: ContextVar[str | None] = ContextVar("selected_workspace", default=None)


def granted_workspace_slugs() -> list[str]:
    """Slugs of the workspaces the caller's token is installed in."""
    token = get_access_token()
    if token is None:
        return []
    return [slug for slug in token.claims.get("workspace_slugs") or [] if slug]


def selected_workspace_slug() -> str | None:
    """Workspace picked for the tool call in progress, if any."""
    return _selected.get()


@contextmanager
def selected_workspace(slug: str) -> Iterator[None]:
    token = _selected.set(slug)
    try:
        yield
    finally:
        _selected.reset(token)
