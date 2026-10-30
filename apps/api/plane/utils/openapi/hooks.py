# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Schema processing hooks for drf-spectacular OpenAPI generation.

This module provides preprocessing and postprocessing functions that modify
the generated OpenAPI schema to apply custom filtering, tagging, and other
transformations.
"""

import inspect

import uritemplate


def preprocess_filter_api_v1_paths(endpoints):
    """
    Filter OpenAPI endpoints to only include /api/v1/ paths and exclude PUT methods.
    """
    filtered = []
    for path, path_regex, method, callback in endpoints:
        # Only include paths that start with /api/v1/ and exclude PUT methods
        if path.startswith("/api/v1/") and method.upper() != "PUT" and "server" not in path.lower():
            filtered.append((path, path_regex, method, callback))
    return filtered


ADMIN_PATH_PREFIX = "/api/instances/"
V1_PATH_PREFIX = "/api/v1/"


def is_callable(path, method, callback):
    """False when the handler cannot take the path's URL kwargs, so every call fails.

    An APIView routed on a list and a detail path gets every method on both paths.
    """
    actions = getattr(callback, "actions", None)
    handler = getattr(callback.cls, actions[method.lower()] if actions else method.lower(), None)
    if handler is None:
        return True
    params = inspect.signature(handler).parameters.values()
    if any(param.kind == param.VAR_KEYWORD for param in params):
        return True
    variables = set(uritemplate.variables(path))
    accepted = {param.name for param in params}
    required = {
        param.name
        for param in params
        if param.default is param.empty
        and param.kind in (param.POSITIONAL_OR_KEYWORD, param.KEYWORD_ONLY)
        and param.name not in ("self", "request")
    }
    return variables <= accepted and required <= variables


def preprocess_filter_internal_paths(endpoints):
    """Keep the session-authenticated paths the web and space apps call."""
    return [
        (path, path_regex, method, callback)
        for path, path_regex, method, callback in endpoints
        if not path.startswith((V1_PATH_PREFIX, ADMIN_PATH_PREFIX)) and is_callable(path, method, callback)
    ]


def preprocess_filter_admin_paths(endpoints):
    """Keep the instance admin paths the admin app calls."""
    return [
        (path, path_regex, method, callback)
        for path, path_regex, method, callback in endpoints
        if path.startswith(ADMIN_PATH_PREFIX) and is_callable(path, method, callback)
    ]


def generate_operation_summary(method, path, tag):
    """
    Generate a human-readable summary for an operation.
    """
    # Extract the main resource from the path
    path_parts = [part for part in path.split("/") if part and not part.startswith("{")]

    if len(path_parts) > 0:
        resource = path_parts[-1].replace("-", " ").title()
    else:
        resource = tag

    # Generate summary based on method
    method_summaries = {
        "GET": f"Retrieve {resource}",
        "POST": f"Create {resource}",
        "PATCH": f"Update {resource}",
        "DELETE": f"Delete {resource}",
    }

    # Handle specific cases
    if "archive" in path.lower():
        if method == "POST":
            return f"Archive {tag.rstrip('s')}"
        elif method == "DELETE":
            return f"Unarchive {tag.rstrip('s')}"

    if "transfer" in path.lower():
        return f"Transfer {tag.rstrip('s')}"

    return method_summaries.get(method, f"{method} {resource}")
