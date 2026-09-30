/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { useTranslation } from "@plane/i18n";
import type { TDashboardChartType, TDashboardDateBucket, TDashboardMetricFunction } from "@plane/types";
import { Field as PropelField } from "@makeplane/propel/components/field";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { Switch } from "@makeplane/propel/components/switch";
import { TextArea, TextAreaGroup } from "@makeplane/propel/components/text-area";
import { Select } from "@plane/blocks/select";
// local imports
import type { TFieldErrors, TWidgetForm } from "./use-widget-form";
import { NO_DIMENSION } from "./use-widget-form";
import type { TDimensionChoice } from "./utils";
import { CHART_TYPES, DATE_BUCKETS, METRIC_FUNCTIONS, dimensionLabel } from "./utils";

const NONE_LABEL_KEY = "insight_dashboards.editor.none";

type TFieldOption<V extends string> = { value: V; label: string; group?: string };

function FieldSelect<V extends string>(props: {
  value: V;
  onChange: (value: V) => void;
  options: TFieldOption<V>[];
  label: string;
}) {
  const { value, onChange, options, label } = props;
  return (
    <Select<TFieldOption<V>>
      getValues={() => options}
      value={options.find((option) => option.value === value) ?? null}
      onChange={(next) => onChange(next as V)}
      getOptionValue={(option) => option.value}
      getOptionLabel={(option) => option.label}
      getOptionGroup={(option) => option.group}
      showSearch={options.length > 8}
      pinSelected={false}
    >
      <Select.Trigger variant="select-md" className="w-full">
        <span className="min-w-0 grow truncate text-left">{label}</span>
      </Select.Trigger>
    </Select>
  );
}

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
        <PropelField invalid={!!errors.title}>
          <InputGroup size="md">
            <Input
              id="widget-title"
              value={form.title}
              onChange={(event) => form.setTitle(event.target.value)}
              placeholder={t("insight_dashboards.editor.title_placeholder")}
              size="md"
            />
          </InputGroup>
        </PropelField>
      </Field>

      <Field label={t("insight_dashboards.editor.query")} htmlFor="widget-query" error={errors.query}>
        <PropelField invalid={!!errors.query}>
          <TextAreaGroup>
            <TextArea
              id="widget-query"
              size="md"
              surface="field"
              value={form.query}
              onChange={(event) => form.setQuery(event.target.value)}
              placeholder={t("insight_dashboards.editor.query_placeholder")}
              spellCheck={false}
            />
          </TextAreaGroup>
        </PropelField>
        <p className="text-11 text-tertiary">{t("insight_dashboards.editor.query_help")}</p>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("insight_dashboards.editor.chart_type")} error={errors.chart_type}>
          <FieldSelect<TDashboardChartType>
            value={form.chartType}
            onChange={(value) => form.setChartType(value)}
            label={t(`insight_dashboards.chart_types.${form.chartType}`)}
            options={CHART_TYPES.map((type) => ({ value: type, label: t(`insight_dashboards.chart_types.${type}`) }))}
          />
        </Field>
        <Field label={t("insight_dashboards.editor.metric")}>
          <FieldSelect<TDashboardMetricFunction>
            value={form.metricFunction}
            onChange={(value) => form.changeMetricFunction(value)}
            label={t(`insight_dashboards.metrics.${form.metricFunction}`)}
            options={METRIC_FUNCTIONS.map((fn) => ({ value: fn, label: t(`insight_dashboards.metrics.${fn}`) }))}
          />
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
        <InputGroup size="md">
          <Input
            id="widget-description"
            value={form.description}
            onChange={(event) => form.setDescription(event.target.value)}
            placeholder={t("insight_dashboards.editor.description_placeholder")}
            size="md"
          />
        </InputGroup>
      </Field>

      <div className="flex items-center justify-between">
        <span className="text-12 text-secondary">{t("insight_dashboards.editor.full_width")}</span>
        <Switch
          checked={form.fullWidth}
          onCheckedChange={form.toggleFullWidth}
          size="sm"
          aria-label={t("insight_dashboards.editor.full_width")}
        />
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
      <FieldSelect
        value={form.metricField}
        onChange={(value) => form.setMetricField(value)}
        label={selected?.label ?? t(NONE_LABEL_KEY)}
        options={form.metricFields.map((field) => ({ value: field.value, label: field.label }))}
      />
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
  const options: TFieldOption<string>[] = [
    ...(allowNone ? [{ value: NO_DIMENSION, label: t(NONE_LABEL_KEY) }] : []),
    ...DIMENSION_GROUPS.flatMap((group) =>
      choices
        .filter((choice) => choice.group === group)
        .map((choice) => ({
          value: choice.value,
          label: choice.label,
          group: t(`insight_dashboards.dimension_groups.${group}`),
        }))
    ),
  ];
  return <FieldSelect value={value} onChange={onChange} label={label} options={options} />;
}

function BucketSelect(props: { value: TDashboardDateBucket; onChange: (value: TDashboardDateBucket) => void }) {
  const { value, onChange } = props;
  const { t } = useTranslation();
  return (
    <Field label={t("insight_dashboards.editor.bucket")}>
      <FieldSelect<TDashboardDateBucket>
        value={value}
        onChange={onChange}
        label={t(`insight_dashboards.buckets.${value}`)}
        options={DATE_BUCKETS.map((bucket) => ({ value: bucket, label: t(`insight_dashboards.buckets.${bucket}`) }))}
      />
    </Field>
  );
}
