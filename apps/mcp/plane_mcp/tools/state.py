"""Workflow states within a project.

Upstream also serves a workspace catalogue of states; this fork keeps states per
project, so project_id is always required.
"""

from __future__ import annotations

from typing import Any, Literal, get_args

from fastmcp import FastMCP
from plane.models.enums import GroupEnum
from plane.models.states import CreateState, PaginatedStateResponse, State, UpdateState

from plane_mcp.client import get_plane_client_context
from plane_mcp.toolkit import (
    Action,
    build_annotations,
    build_description,
    envelope,
    missing,
    needs,
    one_of,
    opt,
    page_params,
)

NAME = "state"
TITLE = "Workflow states"

TRIAGE = "triage"
SETTABLE_GROUPS = tuple(group for group in get_args(GroupEnum) if group != TRIAGE)

ACTIONS = (
    Action("list", ("project_id",), ("cursor", "per_page"), read=True),
    Action("retrieve", ("project_id", "state_id"), read=True),
    Action(
        "create",
        ("project_id", "name", "color"),
        ("description", "sequence", "group", "default", "external_source", "external_id"),
    ),
    Action(
        "update",
        ("project_id", "state_id"),
        ("name", "color", "description", "sequence", "group", "default"),
        note="only the fields you pass are changed",
    ),
    Action("delete", ("project_id", "state_id"), destructive=True),
)

FOOTER = (
    f"group is one of: {', '.join(SETTABLE_GROUPS)}. color is a hex code such as #EF4444. "
    "A project also has a triage state, but Plane owns it: it cannot be created here and is "
    "not listed, and Triage is a reserved name."
)

LEGACY = {
    "list_states": "list",
    "retrieve_state": "retrieve",
    "create_state": "create",
    "update_state": "update",
    "delete_state": "delete",
}


def register(mcp: FastMCP) -> None:
    @mcp.tool(
        name=NAME,
        description=build_description("Workflow states within a project.", ACTIONS, FOOTER),
        annotations=build_annotations(TITLE, ACTIONS),
    )
    def state(
        action: Literal["list", "retrieve", "create", "update", "delete"],
        project_id: str = "",
        state_id: str = "",
        name: str = "",
        color: str = "",
        description: str = "",
        # 0 is a real sequence value, so it cannot use the 0 sentinel.
        sequence: float | None = None,
        group: str = "",
        # Tri-state: False is a meaningful value distinct from "not supplied".
        default: bool | None = None,
        external_source: str = "",
        external_id: str = "",
        cursor: str = "",
        per_page: int = 0,
    ) -> State | dict[str, Any] | str | None:
        client, workspace_slug = get_plane_client_context()

        if not project_id:
            return missing(action, "project_id")
        if error := one_of("group", group, SETTABLE_GROUPS):
            return error

        def payload(model: type) -> Any:
            """The fields this model declares, minus the unset ones."""
            fields = {
                "name": opt(name),
                "color": opt(color),
                "group": opt(group),
                "description": opt(description),
                "sequence": sequence,
                "default": default,
                "external_source": opt(external_source),
                "external_id": opt(external_id),
            }
            return model(**{k: v for k, v in fields.items() if v is not None and k in model.model_fields})

        if action == "list":
            response: PaginatedStateResponse = client.states.list(
                workspace_slug=workspace_slug, project_id=project_id, params=page_params(cursor, per_page)
            )
            return envelope(response)

        if action == "create":
            if error := needs(action, name=name, color=color):
                return error
            return client.states.create(workspace_slug=workspace_slug, project_id=project_id, data=payload(CreateState))

        if not state_id:
            return missing(action, "state_id")

        if action == "retrieve":
            return client.states.retrieve(workspace_slug=workspace_slug, project_id=project_id, state_id=state_id)

        if action == "update":
            return client.states.update(
                workspace_slug=workspace_slug, project_id=project_id, state_id=state_id, data=payload(UpdateState)
            )

        client.states.delete(workspace_slug=workspace_slug, project_id=project_id, state_id=state_id)
        return None
