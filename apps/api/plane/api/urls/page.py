# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    PageListCreateAPIEndpoint,
    PageDetailAPIEndpoint,
    PageCommentListCreateAPIEndpoint,
    PageCommentDetailAPIEndpoint,
    PageCommentResolveAPIEndpoint,
    PageVersionListCreateAPIEndpoint,
    PageVersionDetailAPIEndpoint,
    PageApprovalAPIEndpoint,
    PageApprovalEventsAPIEndpoint,
    PageApprovalRegisterAPIEndpoint,
    PageApprovalReviewDateAPIEndpoint,
    PageApprovalSubmitAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/",
        PageListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="pages",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/",
        PageDetailAPIEndpoint.as_view(http_method_names=["get", "patch"]),
        name="pages",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/comments/",
        PageCommentListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="page-comments",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/comments/<uuid:pk>/",
        PageCommentDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="page-comments",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/comments/<uuid:pk>/resolve/",
        PageCommentResolveAPIEndpoint.as_view(http_method_names=["post", "delete"]),
        name="page-comments-resolve",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/versions/",
        PageVersionListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="page-versions",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/versions/<uuid:pk>/",
        PageVersionDetailAPIEndpoint.as_view(http_method_names=["get"]),
        name="page-versions",
    ),
    # Page approvals. There is no approve or reject here: decisions need a person in the app.
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/page-approvals/",
        PageApprovalRegisterAPIEndpoint.as_view(http_method_names=["get"]),
        name="page-approval-register",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/approval/",
        PageApprovalAPIEndpoint.as_view(http_method_names=["get"]),
        name="page-approval",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/approval/submit/",
        PageApprovalSubmitAPIEndpoint.as_view(http_method_names=["post"]),
        name="page-approval-submit",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/approval/review-date/",
        PageApprovalReviewDateAPIEndpoint.as_view(http_method_names=["post"]),
        name="page-approval-review-date",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/approval/events/",
        PageApprovalEventsAPIEndpoint.as_view(http_method_names=["get"]),
        name="page-approval-events",
    ),
]
