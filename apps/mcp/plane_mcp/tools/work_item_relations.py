"""Work item relation tools for Plane MCP Server.

A relation is one of eight fixed directional types. Upstream also has
user-defined relation types and a separate dependency system; this fork has
neither, so the tools address the one relation endpoint.
"""

from typing import get_args

from fastmcp import FastMCP
from plane.models.enums import WorkItemRelationTypeEnum
from plane.models.work_items import (
    CreateWorkItemRelation,
    RemoveWorkItemRelation,
    WorkItemRelationResponse,
)

from plane_mcp.client import get_plane_client_context

RELATION_TYPES: tuple[str, ...] = get_args(WorkItemRelationTypeEnum)


def register_work_item_relation_tools(mcp: FastMCP) -> None:
    """Register work item relation tools with the MCP server."""

    @mcp.tool()
    def list_work_item_relations(project_id: str, work_item_id: str) -> WorkItemRelationResponse:
        """List every relation for a work item, grouped by type.

        Args:
            project_id: UUID of the project.
            work_item_id: UUID of the work item.

        Returns:
            One key per relation type, each holding the related work items.
        """
        client, workspace_slug = get_plane_client_context()
        return client.work_items.relations.list(
            workspace_slug=workspace_slug,
            project_id=project_id,
            work_item_id=work_item_id,
        )

    @mcp.tool()
    def create_work_item_relation(
        project_id: str,
        work_item_id: str,
        relation_type: str,
        work_item_ids: list[str],
    ) -> None:
        """Relate a work item to one or more targets.

        Args:
            project_id: UUID of the project.
            work_item_id: UUID of the source work item.
            relation_type: One of blocking, blocked_by, duplicate, relates_to,
                start_before, start_after, finish_before, finish_after.
            work_item_ids: UUIDs of the target work items.
        """
        if relation_type not in RELATION_TYPES:
            raise ValueError(f"relation_type must be one of {list(RELATION_TYPES)}")

        client, workspace_slug = get_plane_client_context()
        return client.work_items.relations.create(
            workspace_slug=workspace_slug,
            project_id=project_id,
            work_item_id=work_item_id,
            data=CreateWorkItemRelation(
                relation_type=relation_type,  # type: ignore[arg-type]
                issues=work_item_ids,
            ),
        )

    @mcp.tool()
    def remove_work_item_relation(project_id: str, work_item_id: str, related_work_item_id: str) -> None:
        """Remove the relation between two work items.

        A relation is stored once, so it does not matter which of the two work
        items you call the source.

        Args:
            project_id: UUID of the project.
            work_item_id: UUID of one work item.
            related_work_item_id: UUID of the other.
        """
        client, workspace_slug = get_plane_client_context()
        return client.work_items.relations.delete(
            workspace_slug=workspace_slug,
            project_id=project_id,
            work_item_id=work_item_id,
            data=RemoveWorkItemRelation(related_issue=related_work_item_id),
        )
