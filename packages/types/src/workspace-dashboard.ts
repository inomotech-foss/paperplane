/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TLogoProps } from "./common";

/** A workspace dashboard: a board of PQL widgets. */
export type TWorkspaceDashboard = {
  id: string;
  workspace: string;
  name: string;
  description: string;
  logo_props: TLogoProps;
  /** 0 private (owner only), 1 public (every workspace member). */
  access: 0 | 1;
  owned_by: string;
  sort_order: number;
  widget_count: number;
  is_owner: boolean;
  created_at?: string;
  updated_at?: string;
};

export type TDashboardChartType = "number" | "bar" | "line" | "area" | "pie" | "donut" | "table";

export type TDashboardMetricFunction = "count" | "sum" | "avg" | "min" | "max";

export type TDashboardDateBucket = "day" | "week" | "month" | "quarter" | "year";

/** What a widget measures: a count, or an aggregate of a decimal property or of estimate points. */
export type TDashboardMetric = {
  function: TDashboardMetricFunction;
  /** `property:<id>` or `estimate_points`; absent for `count`. */
  field?: string;
};

/**
 * What a widget splits its metric by: a native field (`state`, `type`,
 * `assignee`, …), a date field with a bucket, `property:<id>` or
 * `ancestor:<type id>` (the nearest ancestor of that work item type).
 */
export type TDashboardDimension = {
  field: string;
  bucket?: TDashboardDateBucket;
};

/** The part of a widget that decides what it shows. */
export type TDashboardWidgetDefinition = {
  chart_type: TDashboardChartType;
  query: string;
  metric: TDashboardMetric;
  dimension: TDashboardDimension | Record<string, never>;
  series: TDashboardDimension | Record<string, never>;
};

export type TWorkspaceDashboardWidget = TDashboardWidgetDefinition & {
  id: string;
  dashboard: string;
  workspace: string;
  title: string;
  description: string;
  config: Record<string, unknown>;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type TWorkspaceDashboardDetail = TWorkspaceDashboard & {
  widgets: TWorkspaceDashboardWidget[];
};

export type TDashboardWidgetDatum = {
  key: string;
  name: string;
  /** The metric value for the bucket, whatever the metric. */
  count: number;
} & Record<string, number | string>;

/** Chart data of one widget, evaluated for the caller. */
export type TDashboardWidgetData = {
  data: TDashboardWidgetDatum[];
  /** Series keys to names, empty without a series. */
  schema: Record<string, string>;
  total: number;
  row_count: number;
  metric: TDashboardMetric;
  dimension: TDashboardDimension | Record<string, never>;
  series: TDashboardDimension | Record<string, never>;
};

export type TDashboardPropertyOption = {
  id: string;
  name: string;
  property_type: "TEXT" | "DECIMAL" | "OPTION" | "DATETIME" | "BOOLEAN" | "RELATION";
  is_multi: boolean;
  project_id: string;
  project_name: string;
  issue_type_id: string | null;
};

/** What a widget may measure and split by in a workspace. */
export type TDashboardOptions = {
  chart_types: TDashboardChartType[];
  metric_functions: TDashboardMetricFunction[];
  date_buckets: TDashboardDateBucket[];
  native_dimensions: string[];
  date_dimensions: string[];
  types: { id: string; name: string; logo_props: TLogoProps }[];
  properties: TDashboardPropertyOption[];
  metric_properties: TDashboardPropertyOption[];
};

/** A widget definition error from the API, naming the offending field. */
export type TDashboardWidgetError = {
  error: string;
  field?: string | null;
};
