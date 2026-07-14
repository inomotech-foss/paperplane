# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    IssuePropertyListCreateAPIEndpoint,
    IssuePropertyDetailAPIEndpoint,
    IssuePropertyOptionListCreateAPIEndpoint,
    IssuePropertyOptionDetailAPIEndpoint,
    IssuePropertyValueAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issue-properties/",
        IssuePropertyListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="issue-property-list",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issue-properties/<uuid:property_id>/",
        IssuePropertyDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="issue-property-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issue-properties/<uuid:property_id>/options/",
        IssuePropertyOptionListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="issue-property-option-list",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issue-properties/<uuid:property_id>/options/<uuid:option_id>/",  # noqa: E501
        IssuePropertyOptionDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="issue-property-option-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:work_item_id>/property-values/",
        IssuePropertyValueAPIEndpoint.as_view(http_method_names=["get", "put"]),
        name="work-item-property-values",
    ),
]
