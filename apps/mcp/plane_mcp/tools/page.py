"""Pages of a project.

Upstream also serves workspace pages, page archiving, deletion, collections and
page-to-work-item links; this fork has none of those endpoints, so every action
here is project scoped.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Literal

from fastmcp import FastMCP
from plane.models.pages import CreatePage, Page
from plane.models.query_params import PaginatedQueryParams

from plane_mcp.client import get_plane_client_context
from plane_mcp.toolkit import (
    Action,
    as_params,
    build_annotations,
    build_description,
    envelope,
    missing,
    needs,
    opt,
    page_params,
)

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
    Action(
        "update",
        ("project_id", "page_id"),
        ("name", "description_html", "parent", "access", "color", "is_locked", "external_source", "external_id"),
        note="pass at least one field; only the fields you pass are changed",
    ),
    Action("list_versions", ("project_id", "page_id"), ("cursor", "per_page"), read=True),
    Action("retrieve_version", ("project_id", "page_id", "version_id"), read=True),
    Action(
        "submit_for_review",
        ("project_id", "page_id"),
        ("comment",),
        note="snapshots the page as it is now for the project's approvers",
    ),
    Action("approval_status", ("project_id", "page_id"), read=True),
    Action("list_approvals", ("project_id",), ("cursor", "per_page"), read=True),
    Action(
        "set_review_date",
        ("project_id", "page_id", "next_review_date"),
        ("comment",),
        note="page approvers and project admins only",
    ),
)

FOOTER = (
    "description_html is the page body as HTML. update replaces the whole body, so retrieve the page "
    "first and send back the edited HTML; people who have the page open see the new body.\n"
    "access is the page access level: 0 public, 1 private. Only the page owner can change it.\n"
    "parent is the UUID of the page to nest under; parent=null moves the page to the top level.\n"
    "A locked page refuses every change except a new parent, unlocking included; unlock it in Plane.\n"
    "Each body change is kept as a version: list_versions lists them newest first without their "
    "bodies, retrieve_version returns one with the body it captured.\n"
    "Approvals, for projects with the page_approvals feature: submit_for_review puts the page in review; "
    "approval_status returns its status (draft, in_review, approved, rejected, baseline), the version in force, "
    "the next review date and the approval log; list_approvals is the document register of the project. "
    "A baseline (status baseline, in_force_kind baseline, event baselined) is content put in force without "
    "review when approvals were switched on: it is not an approval and names no approver; legacy_note and "
    "legacy_* carry what the page recorded before (e.g. Confluence), as text. "
    "Approving, rejecting and baselining cannot be done here: decisions need a person in the Paperplane app, "
    "baselines an admin command. "
    "next_review_date is YYYY-MM-DD."
)

# the latest approval events approval_status returns with the status
APPROVAL_EVENTS_SHOWN = 50

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
        action: Literal[
            "list",
            "retrieve",
            "create",
            "update",
            "list_versions",
            "retrieve_version",
            "submit_for_review",
            "approval_status",
            "list_approvals",
            "set_review_date",
        ],
        project_id: str = "",
        page_id: str = "",
        version_id: str = "",
        name: str = "",
        description_html: str = "",
        # "" leaves the parent alone; None is a real value that moves the page to the top level.
        parent: str | None = "",
        # Left unset rather than defaulted: 0 is a real access level.
        access: int | None = None,
        color: str = "",
        is_locked: bool | None = None,
        external_source: str = "",
        external_id: str = "",
        comment: str = "",
        next_review_date: str = "",
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

        if action == "list_approvals":
            return envelope(
                client.pages._get(
                    f"{workspace_slug}/projects/{project_id}/page-approvals", params=page_params(cursor, per_page)
                )
            )

        if action == "create":
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

        if not page_id:
            return missing(action, "page_id")
        path = f"{workspace_slug}/projects/{project_id}/pages/{page_id}"

        if action == "retrieve":
            return client.pages.retrieve_project_page(
                workspace_slug=workspace_slug, project_id=project_id, page_id=page_id
            )

        # plane-sdk's update_project_page sends PUT and spells the parent parent_id, and it has no version
        # calls. This fork's v1 API takes PATCH with `parent`, so these actions use its request helpers.
        if action == "update":
            fields = {
                "name": opt(name),
                "description_html": opt(description_html),
                "access": access,
                "color": opt(color),
                "is_locked": is_locked,
                "external_source": opt(external_source),
                "external_id": opt(external_id),
            }
            data: dict[str, Any] = {field: value for field, value in fields.items() if value is not None}
            if parent != "":
                data["parent"] = parent
            if not data:
                return missing(action, "a field to change")
            return client.pages._patch(path, data)

        # Approvals have no plane-sdk calls. There is deliberately no approve or reject: the API only
        # takes those from a person signed in to the app.
        if action == "submit_for_review":
            return client.pages._post(f"{path}/approval/submit", {"comment": comment})

        if action == "approval_status":
            approval = client.pages._get(f"{path}/approval")
            events = client.pages._get(f"{path}/approval/events", params={"per_page": APPROVAL_EVENTS_SHOWN})
            return {"approval": approval, "events": events.get("results") if isinstance(events, dict) else events}

        if action == "set_review_date":
            if not next_review_date:
                return missing(action, "next_review_date")
            try:
                date.fromisoformat(next_review_date)
            except ValueError:
                return f"Error: next_review_date must be a date as YYYY-MM-DD, not {next_review_date!r}"
            return client.pages._post(
                f"{path}/approval/review-date", {"next_review_date": next_review_date, "comment": comment}
            )

        if action == "list_versions":
            return envelope(client.pages._get(f"{path}/versions", params=page_params(cursor, per_page)))

        if not version_id:
            return missing(action, "version_id")
        return client.pages._get(f"{path}/versions/{version_id}")
