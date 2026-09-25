/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type {
  TDashboardChartType,
  TDashboardDateBucket,
  TDashboardMetricFunction,
  TDashboardOptions,
  TDashboardWidgetData,
  TDashboardWidgetDefinition,
  TWorkspaceDashboardWidget,
} from "@plane/types";
import { CustomSelect, EModalWidth, Input, ModalCore, TextArea, ToggleSwitch } from "@plane/ui";
// hooks
import { useWorkspaceDashboards } from "@/hooks/store/use-workspace-dashboards";
// local imports
import {
  buildDimensionChoices,
  CHART_TYPES,
  DATE_BUCKETS,
  ESTIMATE_METRIC_FIELD,
  METRIC_FUNCTIONS,
  PROPERTY_PREFIX,
  dimensionLabel,
  metricLabel,
} from "./utils";
import { WidgetChart } from "./widget-chart";

type Props = {
  isOpen: boolean;
  workspaceSlug: string;
  dashboardId: string;
  widget?: TWorkspaceDashboardWidget;
  options: TDashboardOptions | undefined;
  onClose: () => void;
};

type TFieldErrors = Partial<Record<"title" | "query" | "metric" | "dimension" | "series" | "chart_type", string>>;

const NO_DIMENSION = "";
const NONE_LABEL_KEY = "insight_dashboards.editor.none";

const firstError = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
};

/** Create or edit a widget: what to count, over which work items, split how, drawn as what. */
export const WidgetEditorModal = observer(function WidgetEditorModal(props: Props) {
  const { isOpen, workspaceSlug, dashboardId, widget, options, onClose } = props;
  const { t } = useTranslation();
  const { createWidget, updateWidget, previewWidget } = useWorkspaceDashboards();
  // form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [chartType, setChartType] = useState<TDashboardChartType>("bar");
  const [query, setQuery] = useState("");
  const [metricFunction, setMetricFunction] = useState<TDashboardMetricFunction>("count");
  const [metricField, setMetricField] = useState("");
  const [dimensionField, setDimensionField] = useState("state");
  const [dimensionBucket, setDimensionBucket] = useState<TDashboardDateBucket>("month");
  const [seriesField, setSeriesField] = useState(NO_DIMENSION);
  const [seriesBucket, setSeriesBucket] = useState<TDashboardDateBucket>("month");
  const [fullWidth, setFullWidth] = useState(false);
  // preview & submit state
  const [preview, setPreview] = useState<TDashboardWidgetData | null>(null);
  const [errors, setErrors] = useState<TFieldErrors>({});
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(widget?.title ?? "");
    setDescription(widget?.description ?? "");
    setChartType(widget?.chart_type ?? "bar");
    setQuery(widget?.query ?? "");
    setMetricFunction(widget?.metric?.function ?? "count");
    setMetricField(widget?.metric?.field ?? "");
    setDimensionField(widget?.dimension && "field" in widget.dimension ? widget.dimension.field : "state");
    setDimensionBucket(
      widget?.dimension && "bucket" in widget.dimension ? (widget.dimension.bucket ?? "month") : "month"
    );
    setSeriesField(widget?.series && "field" in widget.series ? widget.series.field : NO_DIMENSION);
    setSeriesBucket(widget?.series && "bucket" in widget.series ? (widget.series.bucket ?? "month") : "month");
    setFullWidth(widget?.config?.width === "full");
    setPreview(null);
    setErrors({});
  }, [isOpen, widget]);

  const choices = useMemo(() => buildDimensionChoices(options, t), [options, t]);
  const dimensionChoice = choices.find((choice) => choice.value === dimensionField);
  const seriesChoice = choices.find((choice) => choice.value === seriesField);
  const hasDimension = chartType !== "number";
  const canHaveSeries = hasDimension && chartType !== "pie" && chartType !== "donut";
  const metricFields = [
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
    dimension:
      hasDimension && dimensionField
        ? { field: dimensionField, ...(dimensionChoice?.isTime ? { bucket: dimensionBucket } : {}) }
        : {},
    series:
      canHaveSeries && seriesField
        ? { field: seriesField, ...(seriesChoice?.isTime ? { bucket: seriesBucket } : {}) }
        : {},
  };

  const applyApiErrors = (error: unknown) => {
    const payload = (error ?? {}) as Record<string, unknown>;
    const next: TFieldErrors = {};
    (["title", "query", "metric", "dimension", "series", "chart_type"] as const).forEach((key) => {
      const message = firstError(payload[key]);
      if (message) next[key] = message;
    });
    if (typeof payload.error === "string") {
      const field = typeof payload.field === "string" ? payload.field : "query";
      next[
        (field in next || ["title", "query", "metric", "dimension", "series", "chart_type"].includes(field)
          ? field
          : "query") as keyof TFieldErrors
      ] = payload.error;
    }
    setErrors(next);
    return next;
  };

  const runPreview = async () => {
    setIsPreviewing(true);
    setErrors({});
    try {
      setPreview(await previewWidget(workspaceSlug, definition));
    } catch (error) {
      setPreview(null);
      applyApiErrors(error);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setErrors({ title: t("insight_dashboards.editor.title_required") });
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: Partial<TWorkspaceDashboardWidget> = {
        title: title.trim(),
        description: description.trim(),
        ...definition,
        config: { width: fullWidth ? "full" : "half" },
      };
      if (widget) await updateWidget(workspaceSlug, dashboardId, widget.id, payload);
      else await createWidget(workspaceSlug, dashboardId, payload);
      onClose();
    } catch (error) {
      const next = applyApiErrors(error);
      if (Object.keys(next).length === 0)
        setToast({
          type: TOAST_TYPE.ERROR,
          title: t("common.error.label"),
          message: t("insight_dashboards.editor.save_error"),
        });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldError = (key: keyof TFieldErrors) =>
    errors[key] ? <p className="text-11 text-danger-primary">{errors[key]}</p> : null;

  const selectButtonClassName =
    "w-full justify-between rounded-sm border border-subtle-1 bg-layer-1 px-2 py-1.5 text-12";

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} width={EModalWidth.VXL}>
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-4">
          <h3 className="text-16 font-medium text-primary">
            {widget ? t("insight_dashboards.editor.edit_title") : t("insight_dashboards.editor.create_title")}
          </h3>

          <div className="flex flex-col gap-1">
            <label className="text-12 text-secondary" htmlFor="widget-title">
              {t("insight_dashboards.editor.title")}
            </label>
            <Input
              id="widget-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("insight_dashboards.editor.title_placeholder")}
              hasError={!!errors.title}
              className="w-full"
            />
            {fieldError("title")}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-12 text-secondary" htmlFor="widget-query">
              {t("insight_dashboards.editor.query")}
            </label>
            <TextArea
              id="widget-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("insight_dashboards.editor.query_placeholder")}
              hasError={!!errors.query}
              className="font-mono min-h-[64px] w-full text-12"
              spellCheck={false}
            />
            <p className="text-11 text-tertiary">{t("insight_dashboards.editor.query_help")}</p>
            {fieldError("query")}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-12 text-secondary">{t("insight_dashboards.editor.chart_type")}</span>
              <CustomSelect
                value={chartType}
                onChange={(value: TDashboardChartType) => setChartType(value)}
                label={t(`insight_dashboards.chart_types.${chartType}`)}
                buttonClassName={selectButtonClassName}
                maxHeight="lg"
              >
                {CHART_TYPES.map((type) => (
                  <CustomSelect.Option key={type} value={type}>
                    {t(`insight_dashboards.chart_types.${type}`)}
                  </CustomSelect.Option>
                ))}
              </CustomSelect>
              {fieldError("chart_type")}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-12 text-secondary">{t("insight_dashboards.editor.metric")}</span>
              <CustomSelect
                value={metricFunction}
                onChange={(value: TDashboardMetricFunction) => {
                  setMetricFunction(value);
                  if (value !== "count" && !metricField)
                    setMetricField(metricFields[1]?.value ?? ESTIMATE_METRIC_FIELD);
                }}
                label={t(`insight_dashboards.metrics.${metricFunction}`)}
                buttonClassName={selectButtonClassName}
              >
                {METRIC_FUNCTIONS.map((fn) => (
                  <CustomSelect.Option key={fn} value={fn}>
                    {t(`insight_dashboards.metrics.${fn}`)}
                  </CustomSelect.Option>
                ))}
              </CustomSelect>
            </div>
          </div>

          {metricFunction !== "count" && (
            <div className="flex flex-col gap-1">
              <span className="text-12 text-secondary">{t("insight_dashboards.editor.metric_field")}</span>
              <CustomSelect
                value={metricField}
                onChange={(value: string) => setMetricField(value)}
                label={metricFields.find((field) => field.value === metricField)?.label ?? t(NONE_LABEL_KEY)}
                buttonClassName={selectButtonClassName}
                maxHeight="lg"
              >
                {metricFields.map((field) => (
                  <CustomSelect.Option key={field.value} value={field.value}>
                    {field.label}
                  </CustomSelect.Option>
                ))}
              </CustomSelect>
              {metricFields.length <= 1 && (
                <p className="text-11 text-tertiary">{t("insight_dashboards.editor.no_decimal_properties")}</p>
              )}
              {fieldError("metric")}
            </div>
          )}

          {hasDimension && (
            <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-12 text-secondary">{t("insight_dashboards.editor.dimension")}</span>
                <DimensionSelect
                  value={dimensionField}
                  onChange={setDimensionField}
                  choices={choices}
                  buttonClassName={selectButtonClassName}
                  label={dimensionLabel({ field: dimensionField }, choices, t) || t(NONE_LABEL_KEY)}
                />
                {fieldError("dimension")}
              </div>
              {dimensionChoice?.isTime && (
                <BucketSelect
                  value={dimensionBucket}
                  onChange={setDimensionBucket}
                  buttonClassName={selectButtonClassName}
                />
              )}
            </div>
          )}

          {canHaveSeries && (
            <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-12 text-secondary">{t("insight_dashboards.editor.series")}</span>
                <DimensionSelect
                  value={seriesField}
                  onChange={setSeriesField}
                  choices={choices.filter((choice) => choice.value !== dimensionField)}
                  allowNone
                  buttonClassName={selectButtonClassName}
                  label={seriesField ? dimensionLabel({ field: seriesField }, choices, t) : t(NONE_LABEL_KEY)}
                />
                {fieldError("series")}
              </div>
              {seriesChoice?.isTime && (
                <BucketSelect value={seriesBucket} onChange={setSeriesBucket} buttonClassName={selectButtonClassName} />
              )}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-12 text-secondary" htmlFor="widget-description">
              {t("insight_dashboards.editor.description")}
            </label>
            <Input
              id="widget-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("insight_dashboards.editor.description_placeholder")}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-12 text-secondary">{t("insight_dashboards.editor.full_width")}</span>
            <ToggleSwitch value={fullWidth} onChange={() => setFullWidth((value) => !value)} size="sm" />
          </div>
        </div>

        <div className="flex min-h-[360px] flex-col gap-3 rounded-lg border border-subtle-1 bg-layer-1 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-13 font-medium text-primary">{t("insight_dashboards.editor.preview")}</span>
              <span className="text-11 text-tertiary">
                {metricLabel(definition, options, t)}
                {definition.dimension && "field" in definition.dimension
                  ? ` · ${t("insight_dashboards.widget.by").replace("{dimension}", dimensionLabel(definition.dimension, choices, t))}`
                  : ""}
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void runPreview()} loading={isPreviewing}>
              {t("insight_dashboards.editor.run_preview")}
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            {preview ? (
              <WidgetChart
                chartType={chartType}
                data={preview}
                metricLabel={metricLabel(definition, options, t)}
                dimensionLabel={dimensionLabel(definition.dimension, choices, t)}
                className={chartType === "number" ? "" : "h-[300px]"}
              />
            ) : (
              <div className="grid h-full min-h-[240px] place-items-center text-center text-12 text-tertiary">
                {t("insight_dashboards.editor.preview_hint")}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-subtle-1 pt-3">
            <Button variant="tertiary" size="sm" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button variant="primary" size="sm" onClick={() => void handleSubmit()} loading={isSubmitting}>
              {widget ? t("insight_dashboards.editor.save") : t("insight_dashboards.editor.add")}
            </Button>
          </div>
        </div>
      </div>
    </ModalCore>
  );
});

type TDimensionSelectProps = {
  value: string;
  onChange: (value: string) => void;
  choices: ReturnType<typeof buildDimensionChoices>;
  label: string;
  buttonClassName: string;
  allowNone?: boolean;
};

function DimensionSelect(props: TDimensionSelectProps) {
  const { value, onChange, choices, label, buttonClassName, allowNone } = props;
  const { t } = useTranslation();
  const groups: (typeof choices)[number]["group"][] = ["work_item", "dates", "ancestors", "properties"];
  return (
    <CustomSelect value={value} onChange={onChange} label={label} buttonClassName={buttonClassName} maxHeight="lg">
      {allowNone && <CustomSelect.Option value={NO_DIMENSION}>{t(NONE_LABEL_KEY)}</CustomSelect.Option>}
      {groups.map((group) => {
        const members = choices.filter((choice) => choice.group === group);
        if (members.length === 0) return null;
        return (
          <div key={group}>
            <div className="px-1 pt-1 pb-0.5 text-10 font-medium tracking-wide text-tertiary uppercase">
              {t(`insight_dashboards.dimension_groups.${group}`)}
            </div>
            {members.map((choice) => (
              <CustomSelect.Option key={choice.value} value={choice.value}>
                {choice.label}
              </CustomSelect.Option>
            ))}
          </div>
        );
      })}
    </CustomSelect>
  );
}

function BucketSelect(props: {
  value: TDashboardDateBucket;
  onChange: (value: TDashboardDateBucket) => void;
  buttonClassName: string;
}) {
  const { value, onChange, buttonClassName } = props;
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <span className="text-12 text-secondary">{t("insight_dashboards.editor.bucket")}</span>
      <CustomSelect
        value={value}
        onChange={onChange}
        label={t(`insight_dashboards.buckets.${value}`)}
        buttonClassName={buttonClassName}
      >
        {DATE_BUCKETS.map((bucket) => (
          <CustomSelect.Option key={bucket} value={bucket}>
            {t(`insight_dashboards.buckets.${bucket}`)}
          </CustomSelect.Option>
        ))}
      </CustomSelect>
    </div>
  );
}
