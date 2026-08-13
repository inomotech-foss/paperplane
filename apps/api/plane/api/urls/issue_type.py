# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    IssueTypeImportAPIEndpoint,
    IssueTypeListCreateAPIEndpoint,
    IssueTypeDetailAPIEndpoint,
    WorkspaceIssueTypeListCreateAPIEndpoint,
    WorkspaceIssueTypeDetailAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/work-item-types/",
        WorkspaceIssueTypeListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="workspace-work-item-type-list",
    ),
    path(
        "workspaces/<str:slug>/work-item-types/<uuid:issue_type_id>/",
        WorkspaceIssueTypeDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="workspace-work-item-type-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-item-types/",
        IssueTypeListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="work-item-type-list",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-item-types/<uuid:issue_type_id>/",
        IssueTypeDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="work-item-type-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/import-work-item-types/",
        IssueTypeImportAPIEndpoint.as_view(http_method_names=["post"]),
        name="work-item-type-import",
    ),
]
