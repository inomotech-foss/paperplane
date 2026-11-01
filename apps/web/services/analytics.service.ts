/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema, InternalPaths } from "@plane/api-types";
import { unwrap } from "@plane/services";
import type {
  ChartXAxisProperty,
  IAnalyticsResponse,
  TAnalyticsFilterParams,
  TAnalyticsTabsBase,
  TChart,
  TChartData,
  WorkItemInsightColumns,
} from "@plane/types";
import { findLiteral } from "@plane/types";
import { apiClient } from "@/services/api-client";

export type TCustomChartParams = TAnalyticsFilterParams & {
  x_axis: ChartXAxisProperty;
  group_by?: ChartXAxisProperty;
};

type TChartQuery = NonNullable<
  InternalPaths["/api/workspaces/{slug}/advance-analytics-charts/"]["get"]["parameters"]["query"]
>;
type TChartAxis = NonNullable<TChartQuery["x_axis"]>;

const CHART_AXES: readonly TChartAxis[] = [
  "STATES",
  "STATE_GROUPS",
  "LABELS",
  "ASSIGNEES",
  "ESTIMATE_POINTS",
  "CYCLES",
  "MODULES",
  "PRIORITY",
  "START_DATE",
  "TARGET_DATE",
  "CREATED_AT",
  "COMPLETED_AT",
  "CREATED_BY",
];

const EMPTY_CHART: TChart = { data: [], schema: {} };

/** The project of a peek view, which shows one project. */
export function peekProjectId(params: TAnalyticsFilterParams | undefined): string {
  const projectId = params?.project_ids?.split(",")[0]?.trim();
  if (!projectId) throw new Error("project_ids parameter is required for peek view of work items");
  return projectId;
}

const workspaceQuery = (params: TAnalyticsFilterParams | undefined) => ({ project_ids: params?.project_ids });
const projectQuery = (params: TAnalyticsFilterParams | undefined) => ({
  project_ids: params?.project_ids,
  cycle_id: params?.cycle_id,
  module_id: params?.module_id,
});

export const toInsightRow = (
  row: ApiSchema<"ProjectWorkItemStats"> | ApiSchema<"AssigneeWorkItemStats">
): WorkItemInsightColumns => {
  const columns: WorkItemInsightColumns = {
    cancelled_work_items: row.cancelled_work_items,
    completed_work_items: row.completed_work_items,
    backlog_work_items: row.backlog_work_items,
    un_started_work_items: row.un_started_work_items,
    started_work_items: row.started_work_items,
  };
  if ("project_id" in row) {
    columns.project_id = row.project_id;
    columns.project__name = row.project__name;
    return columns;
  }
  if (row.display_name !== null) columns.display_name = row.display_name;
  if (row.avatar_url !== null) columns.avatar_url = row.avatar_url;
  if (row.assignee_id !== null) columns.assignee_id = row.assignee_id;
  return columns;
};

/** A chart axis the backend reads. The backend would draw an unknown axis as PRIORITY, so it is an error. */
export function toAxis(axis: ChartXAxisProperty): TChartAxis {
  const known = findLiteral(CHART_AXES, axis);
  if (!known) throw new Error(`The backend cannot chart the axis ${axis}`);
  return known;
}

/** Errors are thrown as `ApiError` from `@plane/services`. A peek view reads the project of `project_ids`. */
export class AnalyticsService {
  async getAdvanceAnalytics(
    workspaceSlug: string,
    tab: TAnalyticsTabsBase,
    params?: TAnalyticsFilterParams,
    isPeekView?: boolean
  ): Promise<IAnalyticsResponse> {
    if (isPeekView && tab === "work-items") {
      return unwrap(
        apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/advance-analytics/", {
          params: { path: { slug: workspaceSlug, project_id: peekProjectId(params) }, query: projectQuery(params) },
        })
      );
    }
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/advance-analytics/", {
        params: { path: { slug: workspaceSlug }, query: { tab, ...workspaceQuery(params) } },
      })
    );
  }

  async getWorkItemStats(
    workspaceSlug: string,
    params?: TAnalyticsFilterParams,
    isPeekView?: boolean
  ): Promise<WorkItemInsightColumns[]> {
    const rows = isPeekView
      ? await unwrap(
          apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/advance-analytics-stats/", {
            params: {
              path: { slug: workspaceSlug, project_id: peekProjectId(params) },
              query: { type: "work-items", ...projectQuery(params) },
            },
          })
        )
      : await unwrap(
          apiClient.GET("/api/workspaces/{slug}/advance-analytics-stats/", {
            params: { path: { slug: workspaceSlug }, query: { type: "work-items", ...workspaceQuery(params) } },
          })
        );
    return rows.map(toInsightRow);
  }

  /** The work item totals per project. */
  async getProjectsChart(
    workspaceSlug: string,
    params?: TAnalyticsFilterParams
  ): Promise<TChartData<string, string>[]> {
    const chart = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/advance-analytics-charts/", {
        params: { path: { slug: workspaceSlug }, query: { type: "projects", ...workspaceQuery(params) } },
      })
    );
    return Array.isArray(chart) ? chart : [];
  }

  /** The created and resolved work items per month. */
  async getWorkItemsChart(workspaceSlug: string, params?: TAnalyticsFilterParams, isPeekView?: boolean) {
    return this.getChart(workspaceSlug, { type: "work-items" }, params, isPeekView);
  }

  /** The work items counted by an axis, split by a second axis when given. Throws for an axis the backend cannot chart. */
  async getCustomChart(workspaceSlug: string, params: TCustomChartParams, isPeekView?: boolean): Promise<TChart> {
    const axes = {
      type: "custom-work-items" as const,
      x_axis: toAxis(params.x_axis),
      group_by: params.group_by === undefined ? undefined : toAxis(params.group_by),
    };
    return this.getChart(workspaceSlug, axes, params, isPeekView);
  }

  private async getChart(
    workspaceSlug: string,
    axes: { type: "work-items" | "custom-work-items"; x_axis?: TChartAxis; group_by?: TChartAxis },
    params: TAnalyticsFilterParams | undefined,
    isPeekView: boolean | undefined
  ): Promise<TChart> {
    if (isPeekView) {
      return unwrap(
        apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/advance-analytics-charts/", {
          params: {
            path: { slug: workspaceSlug, project_id: peekProjectId(params) },
            query: { ...axes, ...projectQuery(params) },
          },
        })
      );
    }
    const chart = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/advance-analytics-charts/", {
        params: { path: { slug: workspaceSlug }, query: { ...axes, ...workspaceQuery(params) } },
      })
    );
    return Array.isArray(chart) ? EMPTY_CHART : chart;
  }
}
