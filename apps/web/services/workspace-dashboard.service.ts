/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unwrap } from "@plane/services";
import type {
  TDashboardOptions,
  TDashboardWidgetData,
  TDashboardWidgetDefinition,
  TWorkspaceDashboard,
  TWorkspaceDashboardDetail,
  TWorkspaceDashboardWidget,
} from "@plane/types";
import { apiClient } from "@/services/api-client";
import {
  toDashboard,
  toDashboardCreateBody,
  toDashboardOptions,
  toDashboardUpdateBody,
  toWidget,
  toWidgetCreateBody,
  toWidgetData,
  toWidgetDefinitionBody,
  toWidgetUpdateBody,
} from "@/services/workspace-dashboard-convert";

const workspacePath = (slug: string) => ({ path: { slug } });
const dashboardPath = (slug: string, pk: string) => ({ path: { slug, pk } });
const widgetsPath = (slug: string, dashboard_id: string) => ({ path: { slug, dashboard_id } });
const widgetPath = (slug: string, dashboard_id: string, pk: string) => ({ path: { slug, dashboard_id, pk } });

/** Workspace dashboards and their PQL widgets. Errors are thrown as `ApiError` from `@plane/services`. */
export class WorkspaceDashboardService {
  async list(workspaceSlug: string): Promise<TWorkspaceDashboard[]> {
    const dashboards = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/dashboards/", { params: workspacePath(workspaceSlug) })
    );
    return dashboards.map(toDashboard);
  }

  async retrieve(workspaceSlug: string, dashboardId: string): Promise<TWorkspaceDashboardDetail> {
    const { widgets, ...dashboard } = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/dashboards/{pk}/", { params: dashboardPath(workspaceSlug, dashboardId) })
    );
    return { ...toDashboard(dashboard), widgets: widgets.map(toWidget) };
  }

  async create(workspaceSlug: string, data: Partial<TWorkspaceDashboard>): Promise<TWorkspaceDashboard> {
    const dashboard = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/dashboards/", {
        params: workspacePath(workspaceSlug),
        body: toDashboardCreateBody(data),
      })
    );
    return toDashboard(dashboard);
  }

  async update(
    workspaceSlug: string,
    dashboardId: string,
    data: Partial<TWorkspaceDashboard>
  ): Promise<TWorkspaceDashboard> {
    const dashboard = await unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/dashboards/{pk}/", {
        params: dashboardPath(workspaceSlug, dashboardId),
        body: toDashboardUpdateBody(data),
      })
    );
    return toDashboard(dashboard);
  }

  async remove(workspaceSlug: string, dashboardId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/dashboards/{pk}/", { params: dashboardPath(workspaceSlug, dashboardId) })
    );
  }

  async options(workspaceSlug: string): Promise<TDashboardOptions> {
    return toDashboardOptions(
      await unwrap(
        apiClient.GET("/api/workspaces/{slug}/dashboards/options/", { params: workspacePath(workspaceSlug) })
      )
    );
  }

  async preview(workspaceSlug: string, definition: TDashboardWidgetDefinition): Promise<TDashboardWidgetData> {
    const data = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/dashboards/preview/", {
        params: workspacePath(workspaceSlug),
        body: toWidgetDefinitionBody(definition),
      })
    );
    return toWidgetData(data);
  }

  async createWidget(
    workspaceSlug: string,
    dashboardId: string,
    data: Partial<TWorkspaceDashboardWidget>
  ): Promise<TWorkspaceDashboardWidget> {
    const widget = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/dashboards/{dashboard_id}/widgets/", {
        params: widgetsPath(workspaceSlug, dashboardId),
        body: toWidgetCreateBody(data),
      })
    );
    return toWidget(widget);
  }

  async updateWidget(
    workspaceSlug: string,
    dashboardId: string,
    widgetId: string,
    data: Partial<TWorkspaceDashboardWidget>
  ): Promise<TWorkspaceDashboardWidget> {
    const widget = await unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/dashboards/{dashboard_id}/widgets/{pk}/", {
        params: widgetPath(workspaceSlug, dashboardId, widgetId),
        body: toWidgetUpdateBody(data),
      })
    );
    return toWidget(widget);
  }

  async removeWidget(workspaceSlug: string, dashboardId: string, widgetId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/dashboards/{dashboard_id}/widgets/{pk}/", {
        params: widgetPath(workspaceSlug, dashboardId, widgetId),
      })
    );
  }

  async widgetData(workspaceSlug: string, dashboardId: string, widgetId: string): Promise<TDashboardWidgetData> {
    const data = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/dashboards/{dashboard_id}/widgets/{pk}/data/", {
        params: widgetPath(workspaceSlug, dashboardId, widgetId),
      })
    );
    return toWidgetData(data);
  }
}
