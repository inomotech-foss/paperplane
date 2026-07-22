# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import (
    IssueEmailReplyEndpoint,
    IssueEmailThreadEndpoint,
    ServiceDeskConfigEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/service-desk/",
        ServiceDeskConfigEndpoint.as_view(),
        name="service-desk-config",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/email-thread/",
        IssueEmailThreadEndpoint.as_view(),
        name="issue-email-thread",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/email-replies/",
        IssueEmailReplyEndpoint.as_view(),
        name="issue-email-replies",
    ),
]
