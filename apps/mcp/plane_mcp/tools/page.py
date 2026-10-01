"""Pages of a project.

Upstream also serves workspace pages, page archiving, deletion, collections and
page-to-work-item links; this fork has none of those endpoints, so every action
here is project scoped.
"""

from __future__ import annotations

from typing import Any, Literal

from fastmcp import FastMCP
from plane.models.pages import CreatePage, Page
from plane.models.query_params import PaginatedQueryParams

from plane_mcp.client import get_plane_client_context
from plane_mcp.toolkit import Action, as_params, build_annotations, build_description, envelope, missing, needs, opt

NAME = "page"
TITLE = "Pages"

ACTIONS = (
    Action("list", ("project_id",), ("cursor", "per_page"), read=True),
    Action("retrieve", ("project_id", "page_id"), read=True),
    Action(
        "create",
        ("project_id", "name", "description_html"),
        ("access", "color", "is_locked", "external_source", "external_id"),
    ),
)

FOOTER = "description_html is the page body as HTML. access is the page access level."

LEGACY = {
    "list_pages": "list",
    "retrieve_page": "retrieve",
    "create_page": "create",
}


def register(mcp: FastMCP) -> None:
    @mcp.tool(
        name=NAME,
        description=build_description("Pages of a project.", ACTIONS, FOOTER),
        annotations=build_annotations(TITLE, ACTIONS),
    )
    def page(
        action: Literal["list", "retrieve", "create"],
        project_id: str = "",
        page_id: str = "",
        name: str = "",
        description_html: str = "",
        # Left unset rather than defaulted: 0 is a real access level.
        access: int | None = None,
        color: str = "",
        is_locked: bool | None = None,
        external_source: str = "",
        external_id: str = "",
        cursor: str = "",
        per_page: int = 0,
    ) -> Page | dict[str, Any] | str | None:
        client, workspace_slug = get_plane_client_context()

        if not project_id:
            return missing(action, "project_id")

        if action == "list":
            response = client.pages.list_project_pages(
                workspace_slug=workspace_slug,
                project_id=project_id,
                params=as_params(PaginatedQueryParams, cursor=cursor, per_page=per_page),
            )
            return envelope(response)

        if action == "retrieve":
            if not page_id:
                return missing(action, "page_id")
            return client.pages.retrieve_project_page(
                workspace_slug=workspace_slug, project_id=project_id, page_id=page_id
            )

        if error := needs(action, name=name, description_html=description_html):
            return error
        return client.pages.create_project_page(
            workspace_slug=workspace_slug,
            project_id=project_id,
            data=CreatePage(
                name=name,
                description_html=description_html,
                access=access,
                color=opt(color),
                is_locked=is_locked,
                external_id=opt(external_id),
                external_source=opt(external_source),
            ),
        )
