/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set, sortBy } from "lodash-es";
import { action, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// plane imports
import type {
  TDashboardOptions,
  TDashboardWidgetData,
  TDashboardWidgetDefinition,
  TWorkspaceDashboard,
  TWorkspaceDashboardWidget,
} from "@plane/types";
// services
import { WorkspaceDashboardService } from "@/services/workspace-dashboard.service";
// store
import type { CoreRootStore } from "./root.store";

export interface IWorkspaceDashboardStore {
  // observables
  dashboardMap: Record<string, TWorkspaceDashboard>;
  widgetMap: Record<string, TWorkspaceDashboardWidget>;
  optionsMap: Record<string, TDashboardOptions>;
  fetchedMap: Record<string, boolean>;
  // computed actions
  getWorkspaceDashboards: (workspaceSlug: string | undefined) => TWorkspaceDashboard[] | undefined;
  getDashboardById: (dashboardId: string | undefined) => TWorkspaceDashboard | undefined;
  getDashboardWidgets: (dashboardId: string | undefined) => TWorkspaceDashboardWidget[];
  getWidgetById: (widgetId: string | undefined) => TWorkspaceDashboardWidget | undefined;
  getOptions: (workspaceSlug: string | undefined) => TDashboardOptions | undefined;
  // fetch actions
  fetchDashboards: (workspaceSlug: string) => Promise<TWorkspaceDashboard[]>;
  fetchDashboard: (workspaceSlug: string, dashboardId: string) => Promise<void>;
  fetchOptions: (workspaceSlug: string) => Promise<TDashboardOptions>;
  fetchWidgetData: (workspaceSlug: string, dashboardId: string, widgetId: string) => Promise<TDashboardWidgetData>;
  previewWidget: (workspaceSlug: string, definition: TDashboardWidgetDefinition) => Promise<TDashboardWidgetData>;
  // crud actions
  createDashboard: (workspaceSlug: string, data: Partial<TWorkspaceDashboard>) => Promise<TWorkspaceDashboard>;
  updateDashboard: (
    workspaceSlug: string,
    dashboardId: string,
    data: Partial<TWorkspaceDashboard>
  ) => Promise<TWorkspaceDashboard>;
  deleteDashboard: (workspaceSlug: string, dashboardId: string) => Promise<void>;
  createWidget: (
    workspaceSlug: string,
    dashboardId: string,
    data: Partial<TWorkspaceDashboardWidget>
  ) => Promise<TWorkspaceDashboardWidget>;
  updateWidget: (
    workspaceSlug: string,
    dashboardId: string,
    widgetId: string,
    data: Partial<TWorkspaceDashboardWidget>
  ) => Promise<TWorkspaceDashboardWidget>;
  deleteWidget: (workspaceSlug: string, dashboardId: string, widgetId: string) => Promise<void>;
}

export class WorkspaceDashboardStore implements IWorkspaceDashboardStore {
  // observables
  dashboardMap: Record<string, TWorkspaceDashboard> = {};
  widgetMap: Record<string, TWorkspaceDashboardWidget> = {};
  optionsMap: Record<string, TDashboardOptions> = {};
  fetchedMap: Record<string, boolean> = {};
  // root store
  rootStore;
  // services
  service;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      dashboardMap: observable,
      widgetMap: observable,
      optionsMap: observable,
      fetchedMap: observable,
      fetchDashboards: action,
      fetchDashboard: action,
      fetchOptions: action,
      createDashboard: action,
      updateDashboard: action,
      deleteDashboard: action,
      createWidget: action,
      updateWidget: action,
      deleteWidget: action,
    });
    this.rootStore = _rootStore;
    this.service = new WorkspaceDashboardService();
  }

  getWorkspaceDashboards = computedFn((workspaceSlug: string | undefined) => {
    if (!workspaceSlug || !this.fetchedMap[workspaceSlug]) return undefined;
    const workspaceId = this.rootStore.workspaceRoot.getWorkspaceBySlug(workspaceSlug)?.id;
    return sortBy(
      Object.values(this.dashboardMap).filter((dashboard) => !workspaceId || dashboard.workspace === workspaceId),
      ["sort_order", "name"]
    );
  });

  getDashboardById = computedFn((dashboardId: string | undefined) =>
    dashboardId ? this.dashboardMap[dashboardId] : undefined
  );

  getDashboardWidgets = computedFn((dashboardId: string | undefined) =>
    dashboardId
      ? sortBy(
          Object.values(this.widgetMap).filter((widget) => widget.dashboard === dashboardId),
          ["sort_order", "created_at"]
        )
      : []
  );

  getWidgetById = computedFn((widgetId: string | undefined) => (widgetId ? this.widgetMap[widgetId] : undefined));

  getOptions = computedFn((workspaceSlug: string | undefined) =>
    workspaceSlug ? this.optionsMap[workspaceSlug] : undefined
  );

  fetchDashboards = async (workspaceSlug: string) => {
    const dashboards = await this.service.list(workspaceSlug);
    runInAction(() => {
      const fetchedIds = new Set(dashboards.map((dashboard) => dashboard.id));
      const workspaceId = this.rootStore.workspaceRoot.getWorkspaceBySlug(workspaceSlug)?.id;
      Object.values(this.dashboardMap).forEach((dashboard) => {
        if (dashboard.workspace === workspaceId && !fetchedIds.has(dashboard.id))
          delete this.dashboardMap[dashboard.id];
      });
      dashboards.forEach((dashboard) => set(this.dashboardMap, [dashboard.id], dashboard));
      set(this.fetchedMap, [workspaceSlug], true);
    });
    return dashboards;
  };

  fetchDashboard = async (workspaceSlug: string, dashboardId: string) => {
    const { widgets, ...dashboard } = await this.service.retrieve(workspaceSlug, dashboardId);
    runInAction(() => {
      set(this.dashboardMap, [dashboard.id], dashboard);
      const fetchedIds = new Set(widgets.map((widget) => widget.id));
      Object.values(this.widgetMap).forEach((widget) => {
        if (widget.dashboard === dashboardId && !fetchedIds.has(widget.id)) delete this.widgetMap[widget.id];
      });
      widgets.forEach((widget) => set(this.widgetMap, [widget.id], widget));
    });
  };

  fetchOptions = async (workspaceSlug: string) => {
    const options = await this.service.options(workspaceSlug);
    runInAction(() => set(this.optionsMap, [workspaceSlug], options));
    return options;
  };

  fetchWidgetData = (workspaceSlug: string, dashboardId: string, widgetId: string) =>
    this.service.widgetData(workspaceSlug, dashboardId, widgetId);

  previewWidget = (workspaceSlug: string, definition: TDashboardWidgetDefinition) =>
    this.service.preview(workspaceSlug, definition);

  createDashboard = async (workspaceSlug: string, data: Partial<TWorkspaceDashboard>) => {
    const dashboard = await this.service.create(workspaceSlug, data);
    runInAction(() => set(this.dashboardMap, [dashboard.id], dashboard));
    return dashboard;
  };

  updateDashboard = async (workspaceSlug: string, dashboardId: string, data: Partial<TWorkspaceDashboard>) => {
    const dashboard = await this.service.update(workspaceSlug, dashboardId, data);
    runInAction(() => set(this.dashboardMap, [dashboard.id], { ...this.dashboardMap[dashboard.id], ...dashboard }));
    return dashboard;
  };

  deleteDashboard = async (workspaceSlug: string, dashboardId: string) => {
    await this.service.remove(workspaceSlug, dashboardId);
    runInAction(() => {
      delete this.dashboardMap[dashboardId];
      Object.values(this.widgetMap).forEach((widget) => {
        if (widget.dashboard === dashboardId) delete this.widgetMap[widget.id];
      });
    });
  };

  createWidget = async (workspaceSlug: string, dashboardId: string, data: Partial<TWorkspaceDashboardWidget>) => {
    const widget = await this.service.createWidget(workspaceSlug, dashboardId, data);
    runInAction(() => {
      set(this.widgetMap, [widget.id], widget);
      const dashboard = this.dashboardMap[dashboardId];
      if (dashboard) set(this.dashboardMap, [dashboardId, "widget_count"], (dashboard.widget_count ?? 0) + 1);
    });
    return widget;
  };

  updateWidget = async (
    workspaceSlug: string,
    dashboardId: string,
    widgetId: string,
    data: Partial<TWorkspaceDashboardWidget>
  ) => {
    const widget = await this.service.updateWidget(workspaceSlug, dashboardId, widgetId, data);
    runInAction(() => set(this.widgetMap, [widget.id], widget));
    return widget;
  };

  deleteWidget = async (workspaceSlug: string, dashboardId: string, widgetId: string) => {
    await this.service.removeWidget(workspaceSlug, dashboardId, widgetId);
    runInAction(() => {
      delete this.widgetMap[widgetId];
      const dashboard = this.dashboardMap[dashboardId];
      if (dashboard)
        set(this.dashboardMap, [dashboardId, "widget_count"], Math.max(0, (dashboard.widget_count ?? 1) - 1));
    });
  };
}
