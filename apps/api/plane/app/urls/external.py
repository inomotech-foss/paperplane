# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path


from plane.app.views import UnsplashEndpoint, WritingAssistantEndpoint


urlpatterns = [
    path("unsplash/", UnsplashEndpoint.as_view(), name="unsplash"),
    path(
        "workspaces/<str:slug>/writing-assistant/",
        WritingAssistantEndpoint.as_view(),
        name="writing-assistant",
    ),
]
