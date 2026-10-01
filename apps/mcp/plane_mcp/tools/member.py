"""Workspace and project members."""

from __future__ import annotations

from typing import Literal

from fastmcp import FastMCP
from plane.models.query_params import MemberListQueryParams

from plane_mcp.client import get_plane_client_context
from plane_mcp.toolkit import Action, build_annotations, build_description, missing, opt

NAME = "member"
TITLE = "Members"

ACTIONS = (
    Action("me", note="the authenticated user", read=True),
    Action(
        "list_workspace",
        optional=(
            "first_name",
            "last_name",
            "email",
            "display_name",
            "role_slug",
            "is_active",
            "is_bot",
            "cursor",
            "per_page",
            "order_by",
        ),
        note="name filters match case-insensitively and combine with AND",
        read=True,
    ),
    Action("list_project", ("project_id",), read=True),
)

LEGACY = {
    "get_me": "me",
    "get_workspace_members": "list_workspace",
    "get_project_members": "list_project",
}


def register(mcp: FastMCP) -> None:
    @mcp.tool(
        name=NAME,
        description=build_description("Workspace and project members.", ACTIONS),
        annotations=build_annotations(TITLE, ACTIONS),
    )
    def member(
        action: Literal["me", "list_workspace", "list_project"],
        project_id: str = "",
        first_name: str = "",
        last_name: str = "",
        email: str = "",
        display_name: str = "",
        role_slug: str = "",
        # Tri-state: False filters for inactive/non-bot members, unset filters neither.
        is_active: bool | None = None,
        is_bot: bool | None = None,
        order_by: str = "",
        cursor: str = "",
        per_page: int = 0,
    ):
        client, workspace_slug = get_plane_client_context()

        if action == "me":
            return client.users.get_me()

        if action == "list_workspace":
            return client.workspaces.get_members_lite(
                workspace_slug=workspace_slug,
                params=MemberListQueryParams(
                    first_name=opt(first_name),
                    last_name=opt(last_name),
                    email=opt(email),
                    display_name=opt(display_name),
                    role_slug=opt(role_slug),
                    is_active=is_active,
                    is_bot=is_bot,
                    cursor=opt(cursor),
                    per_page=per_page or 100,
                    order_by=opt(order_by),
                ),
            )

        if not project_id:
            return missing(action, "project_id")
        return client.projects.get_members(workspace_slug=workspace_slug, project_id=project_id)
