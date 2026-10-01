# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.license.api.views import (
    EmailCredentialCheckEndpoint,
    InstanceAdminEndpoint,
    InstanceAdminSignInEndpoint,
    InstanceAdminSignUpEndpoint,
    InstanceAdminOIDCInitiateEndpoint,
    InstanceAdminOIDCCallbackEndpoint,
    InstanceConfigurationEndpoint,
    DisableEmailFeatureEndpoint,
    InstanceEndpoint,
    SignUpScreenVisitedEndpoint,
    InstanceAdminUserMeEndpoint,
    InstanceAdminSignOutEndpoint,
    InstanceAdminUserSessionEndpoint,
    InstanceWorkSpaceAvailabilityCheckEndpoint,
    InstanceWorkSpaceDetailEndpoint,
    InstanceWorkSpaceEndpoint,
    InstanceWorkSpaceTransferOwnerEndpoint,
    InstanceOAuthApplicationEndpoint,
    InstanceUserDeactivateEndpoint,
    InstanceUserDetailEndpoint,
    InstanceUserEndpoint,
    InstanceUserMergeEndpoint,
    InstanceUserMergePreviewEndpoint,
    InstanceUserReactivateEndpoint,
)

urlpatterns = [
    path("", InstanceEndpoint.as_view(), name="instance"),
    path("admins/", InstanceAdminEndpoint.as_view(), name="instance-admins"),
    path("admins/me/", InstanceAdminUserMeEndpoint.as_view(), name="instance-admins"),
    path(
        "admins/session/",
        InstanceAdminUserSessionEndpoint.as_view(),
        name="instance-admin-session",
    ),
    path(
        "admins/sign-out/",
        InstanceAdminSignOutEndpoint.as_view(),
        name="instance-admins",
    ),
    path("admins/<uuid:pk>/", InstanceAdminEndpoint.as_view(), name="instance-admins"),
    path(
        "configurations/",
        InstanceConfigurationEndpoint.as_view(),
        name="instance-configuration",
    ),
    path(
        "configurations/disable-email-feature/",
        DisableEmailFeatureEndpoint.as_view(),
        name="disable-email-configuration",
    ),
    path(
        "admins/sign-in/",
        InstanceAdminSignInEndpoint.as_view(),
        name="instance-admin-sign-in",
    ),
    path(
        "admins/sign-up/",
        InstanceAdminSignUpEndpoint.as_view(),
        name="instance-admin-sign-in",
    ),
    path(
        "admins/oidc/",
        InstanceAdminOIDCInitiateEndpoint.as_view(),
        name="instance-admin-oidc-initiate",
    ),
    path(
        "admins/oidc/callback/",
        InstanceAdminOIDCCallbackEndpoint.as_view(),
        name="instance-admin-oidc-callback",
    ),
    path(
        "admins/sign-up-screen-visited/",
        SignUpScreenVisitedEndpoint.as_view(),
        name="instance-sign-up",
    ),
    path(
        "email-credentials-check/",
        EmailCredentialCheckEndpoint.as_view(),
        name="email-credential-check",
    ),
    path(
        "workspace-slug-check/",
        InstanceWorkSpaceAvailabilityCheckEndpoint.as_view(),
        name="instance-workspace-availability",
    ),
    path("workspaces/", InstanceWorkSpaceEndpoint.as_view(), name="instance-workspace"),
    path(
        "workspaces/<uuid:pk>/",
        InstanceWorkSpaceDetailEndpoint.as_view(),
        name="instance-workspace-detail",
    ),
    path(
        "workspaces/<uuid:pk>/transfer-owner/",
        InstanceWorkSpaceTransferOwnerEndpoint.as_view(),
        name="instance-workspace-transfer-owner",
    ),
    path("users/", InstanceUserEndpoint.as_view(), name="instance-users"),
    path("users/<uuid:pk>/", InstanceUserDetailEndpoint.as_view(), name="instance-user-detail"),
    path(
        "users/<uuid:pk>/deactivate/",
        InstanceUserDeactivateEndpoint.as_view(),
        name="instance-user-deactivate",
    ),
    path(
        "users/<uuid:pk>/reactivate/",
        InstanceUserReactivateEndpoint.as_view(),
        name="instance-user-reactivate",
    ),
    path("users/<uuid:pk>/merge/", InstanceUserMergeEndpoint.as_view(), name="instance-user-merge"),
    path(
        "users/<uuid:pk>/merge/preview/",
        InstanceUserMergePreviewEndpoint.as_view(),
        name="instance-user-merge-preview",
    ),
    # OAuth clients, registered by an instance admin.
    path(
        "oauth-applications/",
        InstanceOAuthApplicationEndpoint.as_view(),
        name="instance-oauth-applications",
    ),
    path(
        "oauth-applications/<int:pk>/",
        InstanceOAuthApplicationEndpoint.as_view(),
        name="instance-oauth-applications",
    ),
]
