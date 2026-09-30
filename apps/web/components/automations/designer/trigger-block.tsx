/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { sortBy } from "lodash-es";
import { Zap } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import type { TAutomationMetadata, TAutomationScheduleConfig, TAutomationTriggerType } from "@plane/types";
// components
import { TimezoneSelect } from "@/components/global/timezone-select";
// local imports
import { AutomationOptionSelect } from "../helpers/option-select";
import { findTrigger } from "../helpers/metadata";

/**
 * Cron day numbering puts Sunday at 0, but the picker reads Monday-first, which
 * is what the rest of the product uses.
 */
const DAYS_OF_WEEK = [
  { value: 1, key: "monday" },
  { value: 2, key: "tuesday" },
  { value: 3, key: "wednesday" },
  { value: 4, key: "thursday" },
  { value: 5, key: "friday" },
  { value: 6, key: "saturday" },
  { value: 0, key: "sunday" },
] as const;

type Props = {
  metadata: TAutomationMetadata | undefined;
  triggerType: TAutomationTriggerType | "";
  triggerConfig: TAutomationScheduleConfig;
  /** Locked once the automation exists, since actions are built on the trigger. */
  triggerLocked: boolean;
  onTriggerChange: (triggerType: TAutomationTriggerType) => void;
  onConfigChange: (config: TAutomationScheduleConfig) => void;
  disabled?: boolean;
};

type TScheduleProps = {
  triggerConfig: TAutomationScheduleConfig;
  patch: (partial: Partial<TAutomationScheduleConfig>) => void;
  disabled?: boolean;
};

const optionButtonClassName = (selected: boolean) =>
  selected
    ? "border-accent-strong bg-accent-subtle text-accent-primary"
    : "border-subtle bg-layer-2 text-secondary hover:bg-layer-1";

function ScheduleWeekdayPicker(props: TScheduleProps) {
  const { triggerConfig, patch, disabled } = props;
  const { t } = useTranslation();
  const current = triggerConfig.days_of_week ?? [];
  const selectedDays = new Set<number>(current);

  const toggleDay = (day: number) => {
    const next = selectedDays.has(day) ? current.filter((value) => value !== day) : sortBy([...current, day]);
    patch({ days_of_week: next });
  };

  return (
    <div>
      <span className="mb-1.5 block text-13 font-medium text-secondary">{t("automations.trigger.schedule.on")}</span>
      <div className="flex flex-wrap gap-1.5">
        {DAYS_OF_WEEK.map((day) => {
          const selected = selectedDays.has(day.value);
          return (
            <button
              key={day.value}
              type="button"
              disabled={disabled}
              onClick={() => toggleDay(day.value)}
              aria-pressed={selected}
              aria-label={t(`automations.days_of_week.${day.key}`)}
              className={`size-8 rounded-sm border text-12 font-medium disabled:opacity-50 ${optionButtonClassName(selected)}`}
            >
              {t(`automations.days_of_week_initial.${day.key}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleNumberField(props: {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className: string;
}) {
  const { id, label, min, max, value, onChange, disabled, className } = props;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-13 font-medium text-secondary">
        {label}
      </label>
      <InputGroup size="md">
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          value={String(value)}
          onChange={(event) => onChange(Number(event.target.value))}
          disabled={disabled}
          size="md"
        />
      </InputGroup>
    </div>
  );
}

/** Fixed schedules: frequency, day and time of day. */
function FixedScheduleFields(props: TScheduleProps) {
  const { triggerConfig, patch, disabled } = props;
  const { t } = useTranslation();
  const frequency = triggerConfig.frequency ?? "daily";

  return (
    <>
      <div className="max-w-xs">
        <span className="mb-1.5 block text-13 font-medium text-secondary">
          {t("automations.trigger.schedule.frequency")}
        </span>
        <AutomationOptionSelect
          value={frequency}
          options={(["daily", "weekly", "monthly"] as const).map((option) => ({
            value: option,
            query: t(`automations.trigger.schedule.frequency_${option}`),
          }))}
          onChange={(value: TAutomationScheduleConfig["frequency"]) => patch({ frequency: value })}
          disabled={disabled}
          className="w-full"
          label={t(`automations.trigger.schedule.frequency_${frequency}`)}
        />
      </div>

      {frequency === "weekly" && <ScheduleWeekdayPicker {...props} />}

      {frequency === "monthly" && (
        <ScheduleNumberField
          id="automation-day-of-month"
          label={t("automations.trigger.schedule.day_of_month")}
          min={1}
          max={31}
          value={triggerConfig.day_of_month ?? 1}
          onChange={(value) => patch({ day_of_month: value })}
          disabled={disabled}
          className="max-w-32"
        />
      )}

      <div className="flex flex-wrap items-end gap-3">
        <ScheduleNumberField
          id="automation-hour"
          label={t("automations.trigger.schedule.hour")}
          min={0}
          max={23}
          value={triggerConfig.hour ?? 9}
          onChange={(value) => patch({ hour: value })}
          disabled={disabled}
          className="w-24"
        />
        <ScheduleNumberField
          id="automation-minute"
          label={t("automations.trigger.schedule.minute")}
          min={0}
          max={59}
          value={triggerConfig.minute ?? 0}
          onChange={(value) => patch({ minute: value })}
          disabled={disabled}
          className="w-24"
        />
      </div>
    </>
  );
}

function CronScheduleField(props: TScheduleProps) {
  const { triggerConfig, patch, disabled } = props;
  const { t } = useTranslation();
  return (
    <div className="max-w-md">
      <label htmlFor="automation-cron" className="mb-1.5 block text-13 font-medium text-secondary">
        {t("automations.trigger.schedule.cron_expression_label")}
      </label>
      <div className="font-mono">
        <InputGroup size="md">
          <Input
            id="automation-cron"
            type="text"
            value={triggerConfig.cron ?? ""}
            onChange={(event) => patch({ cron: event.target.value })}
            placeholder={t("automations.trigger.schedule.cron_expression_placeholder")}
            disabled={disabled}
            size="md"
          />
        </InputGroup>
      </div>
    </div>
  );
}

/** Settings shown for the `schedule` trigger. */
function ScheduleConfig(props: TScheduleProps) {
  const { triggerConfig, patch, disabled } = props;
  const { t } = useTranslation();
  const mode = triggerConfig.mode ?? "fixed";
  const scheduledTarget = triggerConfig.scheduled_target ?? "work_items";

  return (
    <div className="flex flex-col gap-4 rounded-md border border-subtle bg-surface-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-13 font-medium text-secondary">{t("automations.trigger.schedule.schedule_mode")}</span>
        {(["fixed", "cron"] as const).map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => patch({ mode: option })}
            className={`rounded-sm border px-2.5 py-1 text-12 font-medium disabled:opacity-50 ${optionButtonClassName(mode === option)}`}
          >
            {t(`automations.trigger.schedule.schedule_mode_${option}`)}
          </button>
        ))}
      </div>

      {mode === "cron" ? <CronScheduleField {...props} /> : <FixedScheduleFields {...props} />}

      <div className="max-w-md">
        <span className="mb-1.5 block text-13 font-medium text-secondary">
          {t("automations.trigger.schedule.timezone")}
        </span>
        <TimezoneSelect
          value={triggerConfig.timezone}
          onChange={(value) => patch({ timezone: value })}
          label={t("automations.trigger.schedule.timezone_placeholder")}
          disabled={disabled}
          className="w-full"
          buttonClassName="w-full"
        />
      </div>

      <div className="max-w-md">
        <span className="mb-1.5 block text-13 font-medium text-secondary">
          {t("automations.designer.scheduled_target_label")}
        </span>
        <AutomationOptionSelect
          value={scheduledTarget}
          options={(["work_items", "project"] as const).map((option) => ({
            value: option,
            query: t(`automations.designer.scheduled_target_${option}`),
          }))}
          onChange={(value: TAutomationScheduleConfig["scheduled_target"]) => patch({ scheduled_target: value })}
          disabled={disabled}
          className="w-full"
          label={t(`automations.designer.scheduled_target_${scheduledTarget}`)}
        />
      </div>
    </div>
  );
}

export const AutomationTriggerBlock = observer(function AutomationTriggerBlock(props: Props) {
  const { metadata, triggerType, triggerConfig, triggerLocked, onTriggerChange, onConfigChange, disabled } = props;
  const { t } = useTranslation();

  const definition = findTrigger(metadata, triggerType);

  const triggerOptions = (metadata?.triggers ?? []).map((trigger) => ({
    value: trigger.key,
    query: t(trigger.i18n_label),
  }));

  const patch = (partial: Partial<TAutomationScheduleConfig>) => onConfigChange({ ...triggerConfig, ...partial });

  return (
    <section className="rounded-lg border border-subtle bg-layer-2 p-4">
      <header className="mb-3 flex items-center gap-2">
        <div className="grid size-7 shrink-0 place-items-center rounded-sm bg-layer-3">
          <Zap className="size-4 text-accent-primary" />
        </div>
        <h3 className="text-body-sm-semibold">{t("automations.trigger.label")}</h3>
      </header>

      <div className="flex flex-col gap-4">
        <div>
          <span className="mb-1.5 block text-13 font-medium text-secondary">
            {t("automations.trigger.input_label")}
          </span>
          <AutomationOptionSelect
            value={triggerType || null}
            options={triggerOptions}
            onChange={(value: TAutomationTriggerType) => onTriggerChange(value)}
            disabled={disabled || triggerLocked}
            className="w-full max-w-md"
            label={
              definition ? (
                <span className="truncate">{t(definition.i18n_label)}</span>
              ) : (
                <span className="text-tertiary">{t("automations.trigger.input_placeholder")}</span>
              )
            }
          />
          {triggerLocked && (
            <p className="mt-1.5 text-11 text-tertiary">
              {t("automations.trigger.warning.disabled_trigger_switching")}
            </p>
          )}
        </div>

        {triggerType === "schedule" && (
          <ScheduleConfig triggerConfig={triggerConfig} patch={patch} disabled={disabled} />
        )}
      </div>
    </section>
  );
});
