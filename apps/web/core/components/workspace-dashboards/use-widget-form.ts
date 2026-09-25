/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
// plane imports
import type {
  TDashboardChartType,
  TDashboardDateBucket,
  TDashboardDimension,
  TDashboardMetricFunction,
  TDashboardOptions,
  TDashboardWidgetDefinition,
  TWorkspaceDashboardWidget,
} from "@plane/types";
// local imports
import { buildDimensionChoices, ESTIMATE_METRIC_FIELD, PROPERTY_PREFIX } from "./utils";
import type { TDimensionChoice } from "./utils";

export const NO_DIMENSION = "";
const DEFAULT_BUCKET: TDashboardDateBucket = "month";

type TDimensionState = { field: string; bucket: TDashboardDateBucket };

/** A stored dimension (possibly `{}`) as editor state, with defaults. */
const dimensionState = (
  dimension: TDashboardDimension | Record<string, never> | undefined,
  fallbackField: string
): TDimensionState => {
  const field = dimension && "field" in dimension && dimension.field ? dimension.field : fallbackField;
  const bucket = dimension && "bucket" in dimension && dimension.bucket ? dimension.bucket : DEFAULT_BUCKET;
  return { field, bucket };
};

/** Editor state back to the API shape; the bucket only travels for time dimensions. */
const toDimension = (
  state: TDimensionState,
  choice: TDimensionChoice | undefined
): TDashboardDimension | Record<string, never> => {
  if (!state.field) return {};
  return choice?.isTime ? { field: state.field, bucket: state.bucket } : { field: state.field };
};

export type TMetricField = { value: string; label: string };

/**
 * The widget editor's fields and the definition they add up to. Initial
 * values come from the widget being edited; the form remounts per widget,
 * so no effect has to copy props into state.
 */
export const useWidgetForm = (
  widget: TWorkspaceDashboardWidget | undefined,
  options: TDashboardOptions | undefined,
  t: (key: string) => string
) => {
  const [title, setTitle] = useState(widget?.title ?? "");
  const [description, setDescription] = useState(widget?.description ?? "");
  const [chartType, setChartType] = useState<TDashboardChartType>(widget?.chart_type ?? "bar");
  const [query, setQuery] = useState(widget?.query ?? "");
  const [metricFunction, setMetricFunction] = useState<TDashboardMetricFunction>(widget?.metric?.function ?? "count");
  const [metricField, setMetricField] = useState(widget?.metric?.field ?? "");
  const [dimension, setDimension] = useState<TDimensionState>(() => dimensionState(widget?.dimension, "state"));
  const [series, setSeries] = useState<TDimensionState>(() => dimensionState(widget?.series, NO_DIMENSION));
  const [fullWidth, setFullWidth] = useState(widget?.config?.width === "full");

  const choices = useMemo(() => buildDimensionChoices(options, t), [options, t]);
  const dimensionChoice = choices.find((choice) => choice.value === dimension.field);
  const seriesChoice = choices.find((choice) => choice.value === series.field);
  const hasDimension = chartType !== "number";
  const canHaveSeries = hasDimension && chartType !== "pie" && chartType !== "donut";
  const metricFields: TMetricField[] = [
    { value: ESTIMATE_METRIC_FIELD, label: t("insight_dashboards.metrics.estimate_points") },
    ...(options?.metric_properties ?? []).map((property) => ({
      value: `${PROPERTY_PREFIX}${property.id}`,
      label: `${property.name} · ${property.project_name}`,
    })),
  ];

  const definition: TDashboardWidgetDefinition = {
    chart_type: chartType,
    query,
    metric: metricFunction === "count" ? { function: "count" } : { function: metricFunction, field: metricField },
    dimension: hasDimension ? toDimension(dimension, dimensionChoice) : {},
    series: canHaveSeries ? toDimension(series, seriesChoice) : {},
  };

  const changeMetricFunction = (value: TDashboardMetricFunction) => {
    setMetricFunction(value);
    if (value !== "count" && !metricField) setMetricField(metricFields[1]?.value ?? ESTIMATE_METRIC_FIELD);
  };

  return {
    title,
    setTitle,
    description,
    setDescription,
    chartType,
    setChartType,
    query,
    setQuery,
    metricFunction,
    changeMetricFunction,
    metricField,
    setMetricField,
    metricFields,
    dimension,
    setDimensionField: (field: string) => setDimension((state) => ({ ...state, field })),
    setDimensionBucket: (bucket: TDashboardDateBucket) => setDimension((state) => ({ ...state, bucket })),
    series,
    setSeriesField: (field: string) => setSeries((state) => ({ ...state, field })),
    setSeriesBucket: (bucket: TDashboardDateBucket) => setSeries((state) => ({ ...state, bucket })),
    fullWidth,
    toggleFullWidth: () => setFullWidth((value) => !value),
    choices,
    dimensionChoice,
    seriesChoice,
    hasDimension,
    canHaveSeries,
    definition,
  };
};

export type TWidgetForm = ReturnType<typeof useWidgetForm>;

export type TFieldErrors = Partial<
  Record<"title" | "query" | "metric" | "dimension" | "series" | "chart_type", string>
>;

const FIELD_NAMES: (keyof TFieldErrors)[] = ["title", "query", "metric", "dimension", "series", "chart_type"];

const firstError = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
};

/**
 * Field errors out of an API failure: DRF's `{field: [message]}` from the
 * serializer, or `{error, field}` from evaluating the definition.
 */
export const parseWidgetErrors = (error: unknown): TFieldErrors => {
  const payload = (error ?? {}) as Record<string, unknown>;
  const errors: TFieldErrors = {};
  for (const field of FIELD_NAMES) {
    const message = firstError(payload[field]);
    if (message) errors[field] = message;
  }
  if (typeof payload.error === "string") {
    const named = FIELD_NAMES.find((field) => field === payload.field);
    errors[named ?? "query"] = payload.error;
  }
  return errors;
};
