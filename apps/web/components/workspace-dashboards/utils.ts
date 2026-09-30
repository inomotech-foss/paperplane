/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type {
  TDashboardChartType,
  TDashboardDateBucket,
  TDashboardDimension,
  TDashboardMetricFunction,
  TDashboardOptions,
  TDashboardWidgetDefinition,
  TWorkspaceDashboardWidget,
} from "@plane/types";

export const CHART_TYPES: TDashboardChartType[] = ["number", "bar", "line", "area", "pie", "donut", "table"];
export const METRIC_FUNCTIONS: TDashboardMetricFunction[] = ["count", "sum", "avg", "min", "max"];
export const DATE_BUCKETS: TDashboardDateBucket[] = ["day", "week", "month", "quarter", "year"];

/** Dimensions backed by a column of the work item, in the order the editor lists them. */
export const NATIVE_DIMENSIONS = [
  "state",
  "state_group",
  "priority",
  "type",
  "project",
  "assignee",
  "label",
  "cycle",
  "module",
  "created_by",
  "parent",
] as const;

/** Date fields of the work item; each one is bucketed. */
export const DATE_DIMENSIONS = ["target_date", "start_date", "created_at", "completed_at", "updated_at"] as const;

export const PROPERTY_PREFIX = "property:";
export const ANCESTOR_PREFIX = "ancestor:";
export const ESTIMATE_METRIC_FIELD = "estimate_points";

export type TDimensionChoice = {
  value: string;
  label: string;
  /** Group heading in the picker. */
  group: "work_item" | "dates" | "properties" | "ancestors";
  /** Whether the dimension is split into date buckets. */
  isTime: boolean;
};

/** The dimensions a widget can split by in this workspace, for the editor's pickers. */
export const buildDimensionChoices = (
  options: TDashboardOptions | undefined,
  t: (key: string) => string
): TDimensionChoice[] => {
  const choices: TDimensionChoice[] = [
    ...NATIVE_DIMENSIONS.map((field) => ({
      value: field,
      label: t(`insight_dashboards.dimensions.${field}`),
      group: "work_item" as const,
      isTime: false,
    })),
    ...DATE_DIMENSIONS.map((field) => ({
      value: field,
      label: t(`insight_dashboards.dimensions.${field}`),
      group: "dates" as const,
      isTime: true,
    })),
  ];
  options?.types.forEach((type) => {
    choices.push({
      value: `${ANCESTOR_PREFIX}${type.id}`,
      label: t("insight_dashboards.dimensions.ancestor_of").replace("{type}", type.name),
      group: "ancestors",
      isTime: false,
    });
  });
  options?.properties.forEach((property) => {
    choices.push({
      value: `${PROPERTY_PREFIX}${property.id}`,
      label: `${property.name} · ${property.project_name}`,
      group: "properties",
      isTime: property.property_type === "DATETIME",
    });
  });
  return choices;
};

export const dimensionLabel = (
  dimension: TDashboardDimension | Record<string, never> | undefined,
  choices: TDimensionChoice[],
  t: (key: string) => string
): string => {
  if (!dimension || !("field" in dimension) || !dimension.field) return "";
  const choice = choices.find((item) => item.value === dimension.field);
  const base = choice?.label ?? dimension.field;
  return dimension.bucket ? `${base} · ${t(`insight_dashboards.buckets.${dimension.bucket}`)}` : base;
};

export const metricLabel = (
  definition: Pick<TDashboardWidgetDefinition, "metric">,
  options: TDashboardOptions | undefined,
  t: (key: string) => string
): string => {
  const { metric } = definition;
  if (!metric || metric.function === "count") return t("insight_dashboards.metrics.count");
  const field = metric.field ?? "";
  let fieldLabel = field;
  if (field === ESTIMATE_METRIC_FIELD) fieldLabel = t("insight_dashboards.metrics.estimate_points");
  else if (field.startsWith(PROPERTY_PREFIX)) {
    const property = options?.properties.find((item) => item.id === field.slice(PROPERTY_PREFIX.length));
    if (property) fieldLabel = property.name;
  }
  return `${t(`insight_dashboards.metrics.${metric.function}`)} · ${fieldLabel}`;
};

/** The definition part of a widget, as the API takes it. */
export const widgetDefinition = (widget: TWorkspaceDashboardWidget): TDashboardWidgetDefinition => ({
  chart_type: widget.chart_type,
  query: widget.query,
  metric: widget.metric,
  dimension: widget.dimension,
  series: widget.series,
});

export const formatMetricValue = (value: number | string | undefined | null): string => {
  if (value === undefined || value === null || value === "") return "0";
  const number = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(number)) return String(value);
  return number.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

export const isFullWidth = (widget: TWorkspaceDashboardWidget): boolean => widget.config?.width === "full";
