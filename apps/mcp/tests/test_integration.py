"""End-to-end test for the Plane MCP Server, against a live workspace.

Drives a running server over streamable HTTP and writes real data: a project,
work items and an epic, then deletes all of it.

Tools are called by their pre-consolidation names, which still resolve, so this
also covers that compatibility path.

Environment variables:
    PLANE_TEST_API_KEY:        API key for authentication (required)
    PLANE_TEST_WORKSPACE_SLUG: Workspace slug to write to (required)
    PLANE_TEST_MCP_URL:        Server URL (default: http://localhost:8211)

Skipped unless the two required variables are set.
"""

import asyncio
import os
import uuid

import pytest
from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport

# These tests write to a live Plane workspace through a running server, so they
# are skipped unless it has been pointed at one. Without this a fresh clone
# fails two tests on the first `pytest`, which reads as a broken checkout rather
# than as optional coverage.
pytestmark = pytest.mark.skipif(
    not (os.getenv("PLANE_TEST_API_KEY") and os.getenv("PLANE_TEST_WORKSPACE_SLUG")),
    reason=(
        "live integration test: set PLANE_TEST_API_KEY and PLANE_TEST_WORKSPACE_SLUG, "
        "and run a server at PLANE_TEST_MCP_URL (default http://localhost:8211)"
    ),
)


def get_config():
    """Load test configuration from environment."""
    api_key = os.getenv("PLANE_TEST_API_KEY", "")
    workspace_slug = os.getenv("PLANE_TEST_WORKSPACE_SLUG", "")
    mcp_url = os.getenv("PLANE_TEST_MCP_URL", "http://localhost:8211")

    if not api_key or not workspace_slug:
        raise RuntimeError("Missing required env vars: PLANE_TEST_API_KEY, PLANE_TEST_WORKSPACE_SLUG")

    return {
        "api_key": api_key,
        "workspace_slug": workspace_slug,
        "mcp_url": mcp_url,
    }


def extract_result(result):
    """Extract data from MCP tool result."""
    if hasattr(result, "structured_content") and result.structured_content is not None:
        return result.structured_content
    if hasattr(result, "content") and result.content:
        import json

        content = result.content[0]
        if hasattr(content, "text"):
            try:
                return json.loads(content.text)
            except ValueError:
                return {"raw": content.text}
    return {}


async def run_integration_test():
    """
    Full integration test:
    1. Create a project
    2. Create work item 1
    3. Create work item 2
    4. Update work item 2 with work item 1 as parent
    5. Find or create an "Epic" work item type, and create an epic work item
    6. Update work item 2 to be under the epic
    7. List all epics (work items of the "Epic" type)
    8. Delete the epic
    9. Delete work items
    10. Delete project
    """
    config = get_config()
    unique_id = uuid.uuid4().hex[:6]

    transport = StreamableHttpTransport(
        f"{config['mcp_url']}/http/api-key/mcp",
        headers={
            "x-workspace-slug": config["workspace_slug"],
            "authorization": f"Bearer {config['api_key']}",
        },
    )

    async with Client(transport=transport) as client:
        # 1. Create project
        print("Creating project...")
        project_result = await client.call_tool(
            "create_project",
            {
                "name": f"Test Project {unique_id}",
                "identifier": f"TP{unique_id[:3].upper()}",
                "description": "Integration test project",
            },
        )
        project = extract_result(project_result)
        project_id = project["id"]
        print(f"Created project: {project_id}")

        # 2. Create work item 1
        print("Creating work item 1...")
        work_item_1_result = await client.call_tool(
            "create_work_item",
            {
                "project_id": project_id,
                "name": f"Parent Work Item {unique_id}",
            },
        )
        work_item_1 = extract_result(work_item_1_result)
        work_item_1_id = work_item_1["id"]
        print(f"Created work item 1: {work_item_1_id}")

        # 3. Create work item 2
        print("Creating work item 2...")
        work_item_2_result = await client.call_tool(
            "create_work_item",
            {
                "project_id": project_id,
                "name": f"Child Work Item {unique_id}",
            },
        )
        work_item_2 = extract_result(work_item_2_result)
        work_item_2_id = work_item_2["id"]
        print(f"Created work item 2: {work_item_2_id}")

        # 4. Update work item 2 with work item 1 as parent
        print("Setting parent relationship...")
        await client.call_tool(
            "update_work_item",
            {
                "project_id": project_id,
                "work_item_id": work_item_2_id,
                "parent": work_item_1_id,
            },
        )
        print("Set work item 1 as parent of work item 2")

        # 5. Find or create an "Epic" work item type, and create an epic work item
        print("Finding or creating 'Epic' work item type...")
        epic_type_result = await client.call_tool("resolve_work_item_type", {"project_id": project_id, "name": "Epic"})
        epic_type = extract_result(epic_type_result)

        epic_type_id = epic_type["id"]
        print(f"Using 'Epic' work item type: {epic_type_id}")

        print("Creating epic...")
        epic_result = await client.call_tool(
            "create_work_item",
            {
                "project_id": project_id,
                "name": f"Epic {unique_id}",
                "type_id": epic_type_id,
            },
        )

        epic = extract_result(epic_result)

        epic_id = epic["id"]

        print(f"Created epic: {epic_id}")

        # 6. Update work item 2 to be under the epic
        print("Setting parent relationship to epic...")
        await client.call_tool(
            "update_work_item",
            {
                "project_id": project_id,
                "work_item_id": work_item_2_id,
                "parent": epic_id,
            },
        )
        print("Set epic as parent of work item 2")

        # 7. List all epics
        print("Listing epics in project...")
        epics_result = await client.call_tool(
            "list_work_items",
            {
                "project_id": project_id,
                "pql": f'type = "{epic_type_id}"',
            },
        )
        epics = extract_result(epics_result)["results"]
        print(f"Epics in project: {[e['id'] for e in epics]}")

        # 8. Delete work items
        print("Deleting work items...")
        await client.call_tool(
            "delete_work_item",
            {"project_id": project_id, "work_item_id": work_item_2_id},
        )
        print("Deleted work item 2")

        await client.call_tool(
            "delete_work_item",
            {"project_id": project_id, "work_item_id": work_item_1_id},
        )
        print("Deleted work item 1")

        # 9. Delete epic
        print("Deleting epic...")
        await client.call_tool(
            "delete_work_item",
            {"project_id": project_id, "work_item_id": epic_id},
        )
        print("Deleted epic")

        # 10. Delete project
        print("Deleting project...")
        await client.call_tool("delete_project", {"project_id": project_id})
        print("Deleted project")

        print("Integration test passed!")


def test_full_integration():
    """Pytest entry point - runs the async integration test."""
    asyncio.run(run_integration_test())


# The advertised catalogue; retired names resolve but are not listed.
EXPECTED_TOOLS = [
    "cycle",
    "get_pql_reference",
    "intake",
    "label",
    "member",
    "module",
    "page",
    "project",
    "project_estimate",
    "state",
    "workitem",
    "workitem_activity",
    "workitem_attachment",
    "workitem_comment",
    "workitem_link",
    "workitem_property",
    "workitem_relation",
    "workitem_type",
    "workspace",
]


async def run_tools_availability_test():
    """
    Test that all expected tools are available on the MCP server.
    This test verifies that all registered tools are exposed correctly.
    """
    config = get_config()

    transport = StreamableHttpTransport(
        f"{config['mcp_url']}/http/api-key/mcp",
        headers={
            "x-workspace-slug": config["workspace_slug"],
            "authorization": f"Bearer {config['api_key']}",
        },
    )

    async with Client(transport=transport) as client:
        # Get list of available tools
        tools = await client.list_tools()
        tool_names = {tool.name for tool in tools}

        print(f"Found {len(tool_names)} tools on the server")

        # Check that all expected tools are available
        missing_tools = []
        for expected_tool in EXPECTED_TOOLS:
            if expected_tool not in tool_names:
                missing_tools.append(expected_tool)

        if missing_tools:
            print(f"Missing tools: {missing_tools}")
            raise AssertionError(f"The following expected tools are not available: {missing_tools}")

        print(f"All {len(EXPECTED_TOOLS)} expected tools are available!")
        print("Tools availability test passed!")


def test_tools_availability():
    """Pytest entry point - verifies all expected tools are registered."""
    asyncio.run(run_tools_availability_test())


if __name__ == "__main__":
    asyncio.run(run_integration_test())
