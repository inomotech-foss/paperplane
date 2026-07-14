# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    IssueTypeListCreateAPIEndpoint,
    IssueTypeDetailAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issue-types/",
        IssueTypeListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="issue-type-list",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issue-types/<uuid:issue_type_id>/",
        IssueTypeDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="issue-type-detail",
    ),
]
