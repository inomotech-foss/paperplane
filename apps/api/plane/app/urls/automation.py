# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import (
    AutomationMetadataEndpoint,
    ProjectAutomationActionEndpoint,
    ProjectAutomationEndpoint,
    ProjectAutomationRunEndpoint,
    WorkspaceAutomationActionEndpoint,
    WorkspaceAutomationEndpoint,
    WorkspaceAutomationRunEndpoint,
)

urlpatterns = [
    # The trigger/condition/action vocabulary the designer renders from.
    path(
        "workspaces/<str:slug>/automation-metadata/",
        AutomationMetadataEndpoint.as_view(),
        name="automation-metadata",
    ),
    # Project scoped automations
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/automations/",
        ProjectAutomationEndpoint.as_view(),
        name="project-automations",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/automations/<uuid:pk>/",
        ProjectAutomationEndpoint.as_view(),
        name="project-automations",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/automations/<uuid:automation_id>/actions/",
        ProjectAutomationActionEndpoint.as_view(),
        name="project-automation-actions",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/automations/<uuid:automation_id>/actions/<uuid:pk>/",
        ProjectAutomationActionEndpoint.as_view(),
        name="project-automation-actions",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/automations/<uuid:automation_id>/runs/",
        ProjectAutomationRunEndpoint.as_view(),
        name="project-automation-runs",
    ),
    # Workspace scoped (global) automations
    path(
        "workspaces/<str:slug>/automations/",
        WorkspaceAutomationEndpoint.as_view(),
        name="workspace-automations",
    ),
    path(
        "workspaces/<str:slug>/automations/<uuid:pk>/",
        WorkspaceAutomationEndpoint.as_view(),
        name="workspace-automations",
    ),
    path(
        "workspaces/<str:slug>/automations/<uuid:automation_id>/actions/",
        WorkspaceAutomationActionEndpoint.as_view(),
        name="workspace-automation-actions",
    ),
    path(
        "workspaces/<str:slug>/automations/<uuid:automation_id>/actions/<uuid:pk>/",
        WorkspaceAutomationActionEndpoint.as_view(),
        name="workspace-automation-actions",
    ),
    path(
        "workspaces/<str:slug>/automations/<uuid:automation_id>/runs/",
        WorkspaceAutomationRunEndpoint.as_view(),
        name="workspace-automation-runs",
    ),
]
