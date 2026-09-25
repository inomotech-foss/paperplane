/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { useTranslation } from "@plane/i18n";
import type { TDashboardChartType, TDashboardDateBucket, TDashboardMetricFunction } from "@plane/types";
import { CustomSelect, Input, TextArea, ToggleSwitch } from "@plane/ui";
// local imports
import type { TFieldErrors, TWidgetForm } from "./use-widget-form";
import { NO_DIMENSION } from "./use-widget-form";
import type { TDimensionChoice } from "./utils";
import { CHART_TYPES, DATE_BUCKETS, METRIC_FUNCTIONS, dimensionLabel } from "./utils";

const SELECT_BUTTON_CLASS = "w-full justify-between rounded-sm border border-subtle-1 bg-layer-1 px-2 py-1.5 text-12";
const NONE_LABEL_KEY = "insight_dashboards.editor.none";

type Props = {
  form: TWidgetForm;
  errors: TFieldErrors;
};

/** The inputs of the widget editor, in reading order. */
export function WidgetFormFields(props: Props) {
  const { form, errors } = props;
  const { t } = useTranslation();

  return (
    <>
      <Field label={t("insight_dashboards.editor.title")} htmlFor="widget-title" error={errors.title}>
        <Input
          id="widget-title"
          value={form.title}
          onChange={(event) => form.setTitle(event.target.value)}
          placeholder={t("insight_dashboards.editor.title_placeholder")}
          hasError={!!errors.title}
          className="w-full"
        />
      </Field>

      <Field label={t("insight_dashboards.editor.query")} htmlFor="widget-query" error={errors.query}>
        <TextArea
          id="widget-query"
          value={form.query}
          onChange={(event) => form.setQuery(event.target.value)}
          placeholder={t("insight_dashboards.editor.query_placeholder")}
          hasError={!!errors.query}
          className="font-mono min-h-[64px] w-full text-12"
          spellCheck={false}
        />
        <p className="text-11 text-tertiary">{t("insight_dashboards.editor.query_help")}</p>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("insight_dashboards.editor.chart_type")} error={errors.chart_type}>
          <CustomSelect
            value={form.chartType}
            onChange={(value: TDashboardChartType) => form.setChartType(value)}
            label={t(`insight_dashboards.chart_types.${form.chartType}`)}
            buttonClassName={SELECT_BUTTON_CLASS}
            maxHeight="lg"
          >
            {CHART_TYPES.map((type) => (
              <CustomSelect.Option key={type} value={type}>
                {t(`insight_dashboards.chart_types.${type}`)}
              </CustomSelect.Option>
            ))}
          </CustomSelect>
        </Field>
        <Field label={t("insight_dashboards.editor.metric")}>
          <CustomSelect
            value={form.metricFunction}
            onChange={(value: TDashboardMetricFunction) => form.changeMetricFunction(value)}
            label={t(`insight_dashboards.metrics.${form.metricFunction}`)}
            buttonClassName={SELECT_BUTTON_CLASS}
          >
            {METRIC_FUNCTIONS.map((fn) => (
              <CustomSelect.Option key={fn} value={fn}>
                {t(`insight_dashboards.metrics.${fn}`)}
              </CustomSelect.Option>
            ))}
          </CustomSelect>
        </Field>
      </div>

      {form.metricFunction !== "count" && <MetricFieldSelect form={form} error={errors.metric} />}

      {form.hasDimension && (
        <DimensionRow
          label={t("insight_dashboards.editor.dimension")}
          field={form.dimension.field}
          bucket={form.dimension.bucket}
          choice={form.dimensionChoice}
          choices={form.choices}
          onFieldChange={form.setDimensionField}
          onBucketChange={form.setDimensionBucket}
          error={errors.dimension}
        />
      )}

      {form.canHaveSeries && (
        <DimensionRow
          label={t("insight_dashboards.editor.series")}
          field={form.series.field}
          bucket={form.series.bucket}
          choice={form.seriesChoice}
          choices={form.choices.filter((choice) => choice.value !== form.dimension.field)}
          onFieldChange={form.setSeriesField}
          onBucketChange={form.setSeriesBucket}
          error={errors.series}
          allowNone
        />
      )}

      <Field label={t("insight_dashboards.editor.description")} htmlFor="widget-description">
        <Input
          id="widget-description"
          value={form.description}
          onChange={(event) => form.setDescription(event.target.value)}
          placeholder={t("insight_dashboards.editor.description_placeholder")}
          className="w-full"
        />
      </Field>

      <div className="flex items-center justify-between">
        <span className="text-12 text-secondary">{t("insight_dashboards.editor.full_width")}</span>
        <ToggleSwitch value={form.fullWidth} onChange={form.toggleFullWidth} size="sm" />
      </div>
    </>
  );
}

function Field(props: { label: string; htmlFor?: string; error?: string; children: React.ReactNode }) {
  const { label, htmlFor, error, children } = props;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-12 text-secondary" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error && <p className="text-11 text-danger-primary">{error}</p>}
    </div>
  );
}

function MetricFieldSelect(props: { form: TWidgetForm; error?: string }) {
  const { form, error } = props;
  const { t } = useTranslation();
  const selected = form.metricFields.find((field) => field.value === form.metricField);
  return (
    <Field label={t("insight_dashboards.editor.metric_field")} error={error}>
      <CustomSelect
        value={form.metricField}
        onChange={(value: string) => form.setMetricField(value)}
        label={selected?.label ?? t(NONE_LABEL_KEY)}
        buttonClassName={SELECT_BUTTON_CLASS}
        maxHeight="lg"
      >
        {form.metricFields.map((field) => (
          <CustomSelect.Option key={field.value} value={field.value}>
            {field.label}
          </CustomSelect.Option>
        ))}
      </CustomSelect>
      {form.metricFields.length <= 1 && (
        <p className="text-11 text-tertiary">{t("insight_dashboards.editor.no_decimal_properties")}</p>
      )}
    </Field>
  );
}

type TDimensionRowProps = {
  label: string;
  field: string;
  bucket: TDashboardDateBucket;
  choice: TDimensionChoice | undefined;
  choices: TDimensionChoice[];
  onFieldChange: (field: string) => void;
  onBucketChange: (bucket: TDashboardDateBucket) => void;
  error?: string;
  allowNone?: boolean;
};

function DimensionRow(props: TDimensionRowProps) {
  const { label, field, bucket, choice, choices, onFieldChange, onBucketChange, error, allowNone } = props;
  const { t } = useTranslation();
  const selectedLabel = field ? dimensionLabel({ field }, choices, t) : t(NONE_LABEL_KEY);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
      <Field label={label} error={error}>
        <DimensionSelect
          value={field}
          onChange={onFieldChange}
          choices={choices}
          label={selectedLabel}
          allowNone={allowNone}
        />
      </Field>
      {choice?.isTime && <BucketSelect value={bucket} onChange={onBucketChange} />}
    </div>
  );
}

const DIMENSION_GROUPS: TDimensionChoice["group"][] = ["work_item", "dates", "ancestors", "properties"];

type TDimensionSelectProps = {
  value: string;
  onChange: (value: string) => void;
  choices: TDimensionChoice[];
  label: string;
  allowNone?: boolean;
};

function DimensionSelect(props: TDimensionSelectProps) {
  const { value, onChange, choices, label, allowNone } = props;
  const { t } = useTranslation();
  return (
    <CustomSelect value={value} onChange={onChange} label={label} buttonClassName={SELECT_BUTTON_CLASS} maxHeight="lg">
      {allowNone && <CustomSelect.Option value={NO_DIMENSION}>{t(NONE_LABEL_KEY)}</CustomSelect.Option>}
      {DIMENSION_GROUPS.map((group) => (
        <DimensionGroup key={group} group={group} choices={choices.filter((choice) => choice.group === group)} />
      ))}
    </CustomSelect>
  );
}

function DimensionGroup(props: { group: TDimensionChoice["group"]; choices: TDimensionChoice[] }) {
  const { group, choices } = props;
  const { t } = useTranslation();
  if (choices.length === 0) return null;
  return (
    <div>
      <div className="px-1 pt-1 pb-0.5 text-10 font-medium tracking-wide text-tertiary uppercase">
        {t(`insight_dashboards.dimension_groups.${group}`)}
      </div>
      {choices.map((choice) => (
        <CustomSelect.Option key={choice.value} value={choice.value}>
          {choice.label}
        </CustomSelect.Option>
      ))}
    </div>
  );
}

function BucketSelect(props: { value: TDashboardDateBucket; onChange: (value: TDashboardDateBucket) => void }) {
  const { value, onChange } = props;
  const { t } = useTranslation();
  return (
    <Field label={t("insight_dashboards.editor.bucket")}>
      <CustomSelect
        value={value}
        onChange={onChange}
        label={t(`insight_dashboards.buckets.${value}`)}
        buttonClassName={SELECT_BUTTON_CLASS}
      >
        {DATE_BUCKETS.map((bucket) => (
          <CustomSelect.Option key={bucket} value={bucket}>
            {t(`insight_dashboards.buckets.${bucket}`)}
          </CustomSelect.Option>
        ))}
      </CustomSelect>
    </Field>
  );
}
