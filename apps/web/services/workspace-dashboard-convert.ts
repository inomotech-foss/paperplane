// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ApiRequestBody, ApiSchema } from "@plane/api-types";
import { isPlainObject, parseLogoProps } from "@plane/types";
import type {
  TDashboardDimension,
  TDashboardMetric,
  TDashboardOptions,
  TDashboardWidgetData,
  TDashboardWidgetDatum,
  TDashboardWidgetDefinition,
  TWorkspaceDashboard,
  TWorkspaceDashboardWidget,
} from "@plane/types";

type TDashboardsPath = "/api/workspaces/{slug}/dashboards/";
type TWidgetsPath = "/api/workspaces/{slug}/dashboards/{dashboard_id}/widgets/";
export type TDashboardCreateBody = ApiRequestBody<TDashboardsPath, "post">;
export type TDashboardUpdateBody = ApiRequestBody<"/api/workspaces/{slug}/dashboards/{pk}/", "patch">;
export type TWidgetCreateBody = ApiRequestBody<TWidgetsPath, "post">;
export type TWidgetUpdateBody = ApiRequestBody<
  "/api/workspaces/{slug}/dashboards/{dashboard_id}/widgets/{pk}/",
  "patch"
>;

type TDashboardRow = ApiSchema<"Dashboard"> | Omit<ApiSchema<"DashboardDetail">, "widgets">;

export function toDashboard(row: TDashboardRow): TWorkspaceDashboard {
  const dashboard: TWorkspaceDashboard = {
    id: row.id,
    workspace: row.workspace,
    name: row.name,
    description: row.description,
    logo_props: parseLogoProps(row.logo_props),
    access: row.access,
    owned_by: row.owned_by,
    sort_order: row.sort_order,
    is_owner: row.is_owner,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (row.widget_count !== undefined) dashboard.widget_count = row.widget_count;
  return dashboard;
}

const toMetric = (metric: ApiSchema<"WidgetMetric">): TDashboardMetric =>
  metric.field === undefined ? { function: metric.function } : { function: metric.function, field: metric.field };

/** A dimension without a field is the empty object the backend stores for none. */
export function toDimension(dimension: ApiSchema<"WidgetDimension">): TDashboardDimension | Record<string, never> {
  if (!dimension.field) return {};
  return dimension.bucket === undefined
    ? { field: dimension.field }
    : { field: dimension.field, bucket: dimension.bucket };
}

export const toWidget = (row: ApiSchema<"DashboardWidget">): TWorkspaceDashboardWidget => ({
  id: row.id,
  dashboard: row.dashboard,
  workspace: row.workspace,
  title: row.title,
  description: row.description,
  chart_type: row.chart_type,
  query: row.query,
  metric: toMetric(row.metric),
  dimension: toDimension(row.dimension),
  series: toDimension(row.series),
  config: isPlainObject(row.config) ? row.config : {},
  sort_order: row.sort_order,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

type TWidgetRow = ApiSchema<"WidgetData">["data"][number];

/** A bucket of widget data. An aggregate over no values is null, which the charts draw as 0. */
export function toWidgetDatum(row: TWidgetRow): TDashboardWidgetDatum {
  const datum: TDashboardWidgetDatum = { ...row, key: row.key, name: row.name, count: row.count ?? 0 };
  for (const [key, value] of Object.entries(row)) {
    if (value === null) datum[key] = 0;
  }
  return datum;
}

export const toWidgetData = (row: ApiSchema<"WidgetData">): TDashboardWidgetData => ({
  data: row.data.map(toWidgetDatum),
  schema: row.schema,
  total: row.total,
  row_count: row.row_count,
  metric: toMetric(row.metric),
  dimension: toDimension(row.dimension),
  series: toDimension(row.series),
});

export const toDashboardOptions = (row: ApiSchema<"DashboardOptions">): TDashboardOptions => ({
  ...row,
  types: row.types.map((type) => ({ id: type.id, name: type.name, logo_props: parseLogoProps(type.logo_props) })),
});

export const toDashboardUpdateBody = (data: Partial<TWorkspaceDashboard>): TDashboardUpdateBody => ({
  name: data.name,
  description: data.description,
  logo_props: data.logo_props,
  access: data.access,
});

export const toDashboardCreateBody = (data: Partial<TWorkspaceDashboard>): TDashboardCreateBody => ({
  ...toDashboardUpdateBody(data),
  name: data.name ?? "",
});

export const toWidgetDefinitionBody = (definition: Partial<TDashboardWidgetDefinition>) => ({
  chart_type: definition.chart_type,
  query: definition.query,
  metric: definition.metric,
  dimension: definition.dimension,
  series: definition.series,
});

export const toWidgetUpdateBody = (data: Partial<TWorkspaceDashboardWidget>): TWidgetUpdateBody => ({
  ...toWidgetDefinitionBody(data),
  title: data.title,
  description: data.description,
  config: data.config,
});

export const toWidgetCreateBody = (data: Partial<TWorkspaceDashboardWidget>): TWidgetCreateBody => ({
  ...toWidgetUpdateBody(data),
  title: data.title ?? "",
});
