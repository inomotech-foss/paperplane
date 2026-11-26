# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path


from plane.app.views import (
    PageAttachmentContentEndpoint,
    PageAttachmentEndpoint,
    PageViewSet,
    PageFavoriteViewSet,
    PagesDescriptionViewSet,
    PageQueryEndpoint,
    PageVersionEndpoint,
    PageMentionEndpoint,
    PageDuplicateEndpoint,
    PageCommentViewSet,
    PageCommentReactionViewSet,
    PageLiveAccessEndpoint,
    PageApprovalApproveEndpoint,
    PageApprovalEndpoint,
    PageApprovalEventsEndpoint,
    PageApprovalRejectEndpoint,
    PageApprovalReviewDateEndpoint,
    PageApprovalSubmitEndpoint,
    ProjectPageApprovalRegisterEndpoint,
    ProjectPageApproversEndpoint,
    ProjectPageBaselineEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/page-query/",
        PageQueryEndpoint.as_view(),
        name="workspace-page-query",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages-summary/",
        PageViewSet.as_view({"get": "summary"}),
        name="project-pages-summary",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/",
        PageViewSet.as_view({"get": "list", "post": "create"}),
        name="project-pages",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/",
        PageViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="project-pages",
    ),
    # favorite pages
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/favorite-pages/<uuid:page_id>/",
        PageFavoriteViewSet.as_view({"post": "create", "delete": "destroy"}),
        name="user-favorite-pages",
    ),
    # archived pages
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/archive/",
        PageViewSet.as_view({"post": "archive", "delete": "unarchive"}),
        name="project-page-archive-unarchive",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/position/",
        PageViewSet.as_view({"post": "position"}),
        name="project-page-position",
    ),
    # lock and unlock
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/lock/",
        PageViewSet.as_view({"post": "lock", "delete": "unlock"}),
        name="project-pages-lock-unlock",
    ),
    # private and public page
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/access/",
        PageViewSet.as_view({"post": "access"}),
        name="project-pages-access",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/description/",
        PagesDescriptionViewSet.as_view({"get": "retrieve", "patch": "partial_update"}),
        name="page-description",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/live-access/",
        PageLiveAccessEndpoint.as_view(),
        name="page-live-access",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/mentions/",
        PageMentionEndpoint.as_view(),
        name="page-mentions",
    ),
    path(
        "assets/v2/workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/attachments/",
        PageAttachmentEndpoint.as_view(),
        name="project-page-attachments",
    ),
    path(
        "assets/v2/workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/attachments/<uuid:pk>/",
        PageAttachmentEndpoint.as_view(),
        name="project-page-attachments",
    ),
    path(
        "assets/v2/workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/attachments/<uuid:pk>/content/",
        PageAttachmentContentEndpoint.as_view(),
        name="project-page-attachment-content",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/versions/",
        PageVersionEndpoint.as_view(),
        name="page-versions",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/versions/<uuid:pk>/",
        PageVersionEndpoint.as_view(),
        name="page-versions",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/duplicate/",
        PageDuplicateEndpoint.as_view(),
        name="page-duplicate",
    ),
    # page comments (document / inline comment threads)
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/comments/",
        PageCommentViewSet.as_view({"get": "list", "post": "create"}),
        name="project-page-comment",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/comments/<uuid:pk>/",
        PageCommentViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="project-page-comment",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/comments/<uuid:pk>/resolve/",
        PageCommentViewSet.as_view({"post": "resolve", "delete": "unresolve"}),
        name="project-page-comment-resolve",
    ),
    # page comment reactions
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/comments/<uuid:comment_id>/reactions/",
        PageCommentReactionViewSet.as_view({"get": "list", "post": "create"}),
        name="project-page-comment-reaction",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/comments/<uuid:comment_id>/reactions/<str:reaction_code>/",
        PageCommentReactionViewSet.as_view({"delete": "destroy"}),
        name="project-page-comment-reaction",
    ),
    # page approvals (opt-in per project)
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/page-approvals/",
        ProjectPageApprovalRegisterEndpoint.as_view(),
        name="project-page-approval-register",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/page-approvals/baseline/",
        ProjectPageBaselineEndpoint.as_view(),
        name="project-page-approval-baseline",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/page-approvers/",
        ProjectPageApproversEndpoint.as_view(),
        name="project-page-approvers",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/approval/",
        PageApprovalEndpoint.as_view(),
        name="page-approval",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/approval/submit/",
        PageApprovalSubmitEndpoint.as_view(),
        name="page-approval-submit",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/approval/approve/",
        PageApprovalApproveEndpoint.as_view(),
        name="page-approval-approve",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/approval/reject/",
        PageApprovalRejectEndpoint.as_view(),
        name="page-approval-reject",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/approval/review-date/",
        PageApprovalReviewDateEndpoint.as_view(),
        name="page-approval-review-date",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/approval/events/",
        PageApprovalEventsEndpoint.as_view(),
        name="page-approval-events",
    ),
]
