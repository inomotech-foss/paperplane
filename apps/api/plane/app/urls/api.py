# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path
from plane.app.views import ApiTokenEndpoint, ConnectedAppEndpoint

urlpatterns = [
    # API Tokens
    path(
        "users/api-tokens/",
        ApiTokenEndpoint.as_view(),
        name="api-tokens",
    ),
    path(
        "users/api-tokens/<uuid:pk>/",
        ApiTokenEndpoint.as_view(),
        name="api-tokens-details",
    ),
    ## End API Tokens
    # Connected OAuth applications
    path(
        "users/connected-apps/",
        ConnectedAppEndpoint.as_view(),
        name="connected-apps",
    ),
    path(
        "users/connected-apps/<int:pk>/",
        ConnectedAppEndpoint.as_view(),
        name="connected-apps-details",
    ),
]
