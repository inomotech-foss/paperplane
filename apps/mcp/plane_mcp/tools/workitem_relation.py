"""Relations between work items.

A relation is one of eight fixed directional types. Upstream also has
user-defined relation types and a separate dependency system; this fork has
neither, so the tool addresses the one relation endpoint.
"""

from __future__ import annotations

from typing import Any, Literal, get_args

from fastmcp import FastMCP
from plane.models.enums import WorkItemRelationTypeEnum
from plane.models.work_items import CreateWorkItemRelation, RemoveWorkItemRelation

from plane_mcp.client import get_plane_client_context
from plane_mcp.toolkit import Action, build_annotations, build_description, coerce_list, missing, needs, one_of

NAME = "workitem_relation"
TITLE = "Work item relations"

RELATION_TYPES: tuple[str, ...] = get_args(WorkItemRelationTypeEnum)

ACTIONS = (
    Action("list", ("project_id", "workitem_id"), note="grouped by relation type", read=True),
    Action("create", ("project_id", "workitem_id", "relation_type", "workitem_ids")),
    Action(
        "delete",
        ("project_id", "workitem_id", "related_workitem_id"),
        note="a relation is stored once, so either work item can be the source",
        destructive=True,
    ),
)

FOOTER = f"relation_type is one of: {', '.join(RELATION_TYPES)}. workitem_ids takes one id or several."

LEGACY = {
    "list_work_item_relations": "list",
    "create_work_item_relation": "create",
    "remove_work_item_relation": "delete",
}


def register(mcp: FastMCP) -> None:
    @mcp.tool(
        name=NAME,
        description=build_description("Relations between work items.", ACTIONS, FOOTER),
        annotations=build_annotations(TITLE, ACTIONS),
    )
    def workitem_relation(
        action: Literal["list", "create", "delete"],
        project_id: str = "",
        workitem_id: str = "",
        workitem_ids: list[str] | None = None,
        related_workitem_id: str = "",
        relation_type: str = "",
    ) -> Any:
        client, workspace_slug = get_plane_client_context()

        if error := needs(action, project_id=project_id, workitem_id=workitem_id):
            return error

        if action == "list":
            return client.work_items.relations.list(
                workspace_slug=workspace_slug, project_id=project_id, work_item_id=workitem_id
            )

        if action == "create":
            targets = coerce_list(workitem_ids)
            if error := needs(action, relation_type=relation_type, workitem_ids=targets):
                return error
            if error := one_of("relation_type", relation_type, RELATION_TYPES):
                return error
            return client.work_items.relations.create(
                workspace_slug=workspace_slug,
                project_id=project_id,
                work_item_id=workitem_id,
                data=CreateWorkItemRelation(
                    relation_type=relation_type,  # type: ignore[arg-type]
                    issues=targets,
                ),
            )

        if not related_workitem_id:
            return missing(action, "related_workitem_id")
        client.work_items.relations.delete(
            workspace_slug=workspace_slug,
            project_id=project_id,
            work_item_id=workitem_id,
            data=RemoveWorkItemRelation(related_issue=related_workitem_id),
        )
        return None
