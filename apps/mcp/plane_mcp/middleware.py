"""Custom FastMCP middleware for the Plane MCP Server."""

from __future__ import annotations

import copy
from collections.abc import Sequence

import mcp.types as mt
from fastmcp.exceptions import ToolError
from fastmcp.server.middleware import CallNext, Middleware, MiddlewareContext
from fastmcp.server.middleware.logging import StructuredLoggingMiddleware
from fastmcp.tools.base import Tool, ToolResult

from plane_mcp.workspace import (
    WORKSPACE_SLUG_ARGUMENT,
    granted_workspace_slugs,
    selected_workspace,
)


class PlaneLoggingMiddleware(StructuredLoggingMiddleware):
    """StructuredLoggingMiddleware that also records the tool name."""

    def _with_tool_name(self, context: MiddlewareContext, message: dict) -> dict:
        if context.method == "tools/call":
            message["tool"] = getattr(context.message, "name", "unknown")
        return message

    def _create_after_message(self, context: MiddlewareContext, start_time: float) -> dict:
        return self._with_tool_name(context, super()._create_after_message(context, start_time))

    def _create_error_message(self, context: MiddlewareContext, start_time: float, error: Exception) -> dict:
        return self._with_tool_name(context, super()._create_error_message(context, start_time, error))


class WorkspaceSelectionMiddleware(Middleware):
    """Let a caller pick which of its granted workspaces a tool call acts in.

    A token is installed in every workspace the user ticked on the consent
    screen, and the API refuses any other, so the choice has to reach the tool.
    Advertising and consuming one argument here keeps it out of all 160 tool
    signatures.

    The argument appears only once a token grants two or more workspaces.
    """

    async def on_list_tools(
        self,
        context: MiddlewareContext[mt.ListToolsRequest],
        call_next: CallNext[mt.ListToolsRequest, Sequence[Tool]],
    ) -> Sequence[Tool]:
        tools = await call_next(context)
        slugs = granted_workspace_slugs()
        if len(slugs) < 2:
            return tools
        return [_with_workspace_argument(tool, slugs) for tool in tools]

    async def on_call_tool(
        self,
        context: MiddlewareContext[mt.CallToolRequestParams],
        call_next: CallNext[mt.CallToolRequestParams, ToolResult],
    ) -> ToolResult:
        arguments = dict(context.message.arguments or {})
        slug = arguments.pop(WORKSPACE_SLUG_ARGUMENT, None)
        slugs = granted_workspace_slugs()

        if slug is None:
            if len(slugs) < 2:
                return await call_next(context)
            raise ToolError(f"{WORKSPACE_SLUG_ARGUMENT} is required, one of: {', '.join(slugs)}")
        if slug not in slugs:
            raise ToolError(f"This authorization does not cover the workspace {slug}")

        # The tools take no such argument, so it has to come back out again.
        message = context.message.model_copy(update={"arguments": arguments})
        with selected_workspace(slug):
            return await call_next(context.copy(message=message))


def _with_workspace_argument(tool: Tool, slugs: list[str]) -> Tool:
    parameters = copy.deepcopy(tool.parameters)
    parameters.setdefault("properties", {})[WORKSPACE_SLUG_ARGUMENT] = {
        "type": "string",
        "enum": slugs,
        "description": "Slug of the workspace to act in.",
    }
    required = parameters.setdefault("required", [])
    if WORKSPACE_SLUG_ARGUMENT not in required:
        required.append(WORKSPACE_SLUG_ARGUMENT)
    return tool.model_copy(update={"parameters": parameters})
