/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type {
  TDashboardOptions,
  TDashboardWidgetData,
  TDashboardWidgetDefinition,
  TWorkspaceDashboard,
  TWorkspaceDashboardDetail,
  TWorkspaceDashboardWidget,
} from "@plane/types";
// services
import { APIService } from "@/services/api.service";

const rethrow = (error: { response?: { data?: unknown } }) => {
  throw error?.response?.data;
};

/** Workspace dashboards and their PQL widgets. */
export class WorkspaceDashboardService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  private base(workspaceSlug: string) {
    return `/api/workspaces/${workspaceSlug}/dashboards/`;
  }

  async list(workspaceSlug: string): Promise<TWorkspaceDashboard[]> {
    return this.get(this.base(workspaceSlug))
      .then((response) => response?.data)
      .catch(rethrow);
  }

  async retrieve(workspaceSlug: string, dashboardId: string): Promise<TWorkspaceDashboardDetail> {
    return this.get(`${this.base(workspaceSlug)}${dashboardId}/`)
      .then((response) => response?.data)
      .catch(rethrow);
  }

  async create(workspaceSlug: string, data: Partial<TWorkspaceDashboard>): Promise<TWorkspaceDashboard> {
    return this.post(this.base(workspaceSlug), data)
      .then((response) => response?.data)
      .catch(rethrow);
  }

  async update(
    workspaceSlug: string,
    dashboardId: string,
    data: Partial<TWorkspaceDashboard>
  ): Promise<TWorkspaceDashboard> {
    return this.patch(`${this.base(workspaceSlug)}${dashboardId}/`, data)
      .then((response) => response?.data)
      .catch(rethrow);
  }

  async remove(workspaceSlug: string, dashboardId: string): Promise<void> {
    return this.delete(`${this.base(workspaceSlug)}${dashboardId}/`)
      .then((response) => response?.data)
      .catch(rethrow);
  }

  async options(workspaceSlug: string): Promise<TDashboardOptions> {
    return this.get(`${this.base(workspaceSlug)}options/`)
      .then((response) => response?.data)
      .catch(rethrow);
  }

  async preview(workspaceSlug: string, definition: TDashboardWidgetDefinition): Promise<TDashboardWidgetData> {
    return this.post(`${this.base(workspaceSlug)}preview/`, definition)
      .then((response) => response?.data)
      .catch(rethrow);
  }

  async createWidget(
    workspaceSlug: string,
    dashboardId: string,
    data: Partial<TWorkspaceDashboardWidget>
  ): Promise<TWorkspaceDashboardWidget> {
    return this.post(`${this.base(workspaceSlug)}${dashboardId}/widgets/`, data)
      .then((response) => response?.data)
      .catch(rethrow);
  }

  async updateWidget(
    workspaceSlug: string,
    dashboardId: string,
    widgetId: string,
    data: Partial<TWorkspaceDashboardWidget>
  ): Promise<TWorkspaceDashboardWidget> {
    return this.patch(`${this.base(workspaceSlug)}${dashboardId}/widgets/${widgetId}/`, data)
      .then((response) => response?.data)
      .catch(rethrow);
  }

  async removeWidget(workspaceSlug: string, dashboardId: string, widgetId: string): Promise<void> {
    return this.delete(`${this.base(workspaceSlug)}${dashboardId}/widgets/${widgetId}/`)
      .then((response) => response?.data)
      .catch(rethrow);
  }

  async widgetData(workspaceSlug: string, dashboardId: string, widgetId: string): Promise<TDashboardWidgetData> {
    return this.get(`${this.base(workspaceSlug)}${dashboardId}/widgets/${widgetId}/data/`)
      .then((response) => response?.data)
      .catch(rethrow);
  }
}
