# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import (
    DashboardOptionsEndpoint,
    DashboardViewSet,
    DashboardWidgetDataEndpoint,
    DashboardWidgetPreviewEndpoint,
    DashboardWidgetViewSet,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/dashboards/",
        DashboardViewSet.as_view({"get": "list", "post": "create"}),
        name="workspace-dashboards",
    ),
    path(
        "workspaces/<str:slug>/dashboards/options/",
        DashboardOptionsEndpoint.as_view(),
        name="workspace-dashboard-options",
    ),
    path(
        "workspaces/<str:slug>/dashboards/preview/",
        DashboardWidgetPreviewEndpoint.as_view(),
        name="workspace-dashboard-preview",
    ),
    path(
        "workspaces/<str:slug>/dashboards/<uuid:pk>/",
        DashboardViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="workspace-dashboards",
    ),
    path(
        "workspaces/<str:slug>/dashboards/<uuid:dashboard_id>/widgets/",
        DashboardWidgetViewSet.as_view({"get": "list", "post": "create"}),
        name="workspace-dashboard-widgets",
    ),
    path(
        "workspaces/<str:slug>/dashboards/<uuid:dashboard_id>/widgets/<uuid:pk>/",
        DashboardWidgetViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="workspace-dashboard-widgets",
    ),
    path(
        "workspaces/<str:slug>/dashboards/<uuid:dashboard_id>/widgets/<uuid:pk>/data/",
        DashboardWidgetDataEndpoint.as_view(),
        name="workspace-dashboard-widget-data",
    ),
]
