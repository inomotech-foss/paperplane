/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Zap } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Input } from "@plane/propel/input";
import type { TAutomationMetadata, TAutomationScheduleConfig, TAutomationTriggerType } from "@plane/types";
import { CustomSearchSelect } from "@plane/ui";
// components
import { TimezoneSelect } from "@/components/global/timezone-select";
// local imports
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

export const AutomationTriggerBlock = observer(function AutomationTriggerBlock(props: Props) {
  const { metadata, triggerType, triggerConfig, triggerLocked, onTriggerChange, onConfigChange, disabled } = props;
  const { t } = useTranslation();

  const definition = findTrigger(metadata, triggerType);
  const isScheduled = triggerType === "schedule";
  const mode = triggerConfig.mode ?? "fixed";
  const frequency = triggerConfig.frequency ?? "daily";

  const triggerOptions = (metadata?.triggers ?? []).map((trigger) => ({
    value: trigger.key,
    query: t(trigger.i18n_label),
    content: <span className="truncate">{t(trigger.i18n_label)}</span>,
  }));

  const patch = (partial: Partial<TAutomationScheduleConfig>) => onConfigChange({ ...triggerConfig, ...partial });

  const toggleDay = (day: number) => {
    const current = triggerConfig.days_of_week ?? [];
    const next = current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort();
    patch({ days_of_week: next });
  };

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
          <CustomSearchSelect
            value={triggerType || null}
            options={triggerOptions}
            onChange={(value: TAutomationTriggerType) => onTriggerChange(value)}
            disabled={disabled || triggerLocked}
            input
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

        {isScheduled && (
          <div className="flex flex-col gap-4 rounded-md border border-subtle bg-surface-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-13 font-medium text-secondary">
                {t("automations.trigger.schedule.schedule_mode")}
              </span>
              {(["fixed", "cron"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={disabled}
                  onClick={() => patch({ mode: option })}
                  className={`rounded-sm border px-2.5 py-1 text-12 font-medium disabled:opacity-50 ${
                    mode === option
                      ? "border-accent-strong bg-accent-subtle text-accent-primary"
                      : "border-subtle bg-layer-2 text-secondary hover:bg-layer-1"
                  }`}
                >
                  {t(`automations.trigger.schedule.schedule_mode_${option}`)}
                </button>
              ))}
            </div>

            {mode === "cron" ? (
              <div className="max-w-md">
                <label htmlFor="automation-cron" className="mb-1.5 block text-13 font-medium text-secondary">
                  {t("automations.trigger.schedule.cron_expression_label")}
                </label>
                <Input
                  id="automation-cron"
                  type="text"
                  value={triggerConfig.cron ?? ""}
                  onChange={(event) => patch({ cron: event.target.value })}
                  placeholder={t("automations.trigger.schedule.cron_expression_placeholder")}
                  disabled={disabled}
                  className="font-mono w-full"
                />
              </div>
            ) : (
              <>
                <div className="max-w-xs">
                  <span className="mb-1.5 block text-13 font-medium text-secondary">
                    {t("automations.trigger.schedule.frequency")}
                  </span>
                  <CustomSearchSelect
                    value={frequency}
                    options={(["daily", "weekly", "monthly"] as const).map((option) => ({
                      value: option,
                      query: t(`automations.trigger.schedule.frequency_${option}`),
                      content: t(`automations.trigger.schedule.frequency_${option}`),
                    }))}
                    onChange={(value: TAutomationScheduleConfig["frequency"]) => patch({ frequency: value })}
                    disabled={disabled}
                    input
                    className="w-full"
                    label={t(`automations.trigger.schedule.frequency_${frequency}`)}
                  />
                </div>

                {frequency === "weekly" && (
                  <div>
                    <span className="mb-1.5 block text-13 font-medium text-secondary">
                      {t("automations.trigger.schedule.on")}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS_OF_WEEK.map((day) => {
                        const selected = (triggerConfig.days_of_week ?? []).includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleDay(day.value)}
                            aria-pressed={selected}
                            aria-label={t(`automations.days_of_week.${day.key}`)}
                            className={`size-8 rounded-sm border text-12 font-medium disabled:opacity-50 ${
                              selected
                                ? "border-accent-strong bg-accent-subtle text-accent-primary"
                                : "border-subtle bg-layer-2 text-secondary hover:bg-layer-1"
                            }`}
                          >
                            {t(`automations.days_of_week_initial.${day.key}`)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {frequency === "monthly" && (
                  <div className="max-w-32">
                    <label
                      htmlFor="automation-day-of-month"
                      className="mb-1.5 block text-13 font-medium text-secondary"
                    >
                      {t("automations.trigger.schedule.day_of_month")}
                    </label>
                    <Input
                      id="automation-day-of-month"
                      type="number"
                      min={1}
                      max={31}
                      value={String(triggerConfig.day_of_month ?? 1)}
                      onChange={(event) => patch({ day_of_month: Number(event.target.value) })}
                      disabled={disabled}
                      className="w-full"
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-24">
                    <label htmlFor="automation-hour" className="mb-1.5 block text-13 font-medium text-secondary">
                      {t("automations.trigger.schedule.hour")}
                    </label>
                    <Input
                      id="automation-hour"
                      type="number"
                      min={0}
                      max={23}
                      value={String(triggerConfig.hour ?? 9)}
                      onChange={(event) => patch({ hour: Number(event.target.value) })}
                      disabled={disabled}
                      className="w-full"
                    />
                  </div>
                  <div className="w-24">
                    <label htmlFor="automation-minute" className="mb-1.5 block text-13 font-medium text-secondary">
                      {t("automations.trigger.schedule.minute")}
                    </label>
                    <Input
                      id="automation-minute"
                      type="number"
                      min={0}
                      max={59}
                      value={String(triggerConfig.minute ?? 0)}
                      onChange={(event) => patch({ minute: Number(event.target.value) })}
                      disabled={disabled}
                      className="w-full"
                    />
                  </div>
                </div>
              </>
            )}

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
              <CustomSearchSelect
                value={triggerConfig.scheduled_target ?? "work_items"}
                options={(["work_items", "project"] as const).map((option) => ({
                  value: option,
                  query: t(`automations.designer.scheduled_target_${option}`),
                  content: <span className="truncate">{t(`automations.designer.scheduled_target_${option}`)}</span>,
                }))}
                onChange={(value: TAutomationScheduleConfig["scheduled_target"]) => patch({ scheduled_target: value })}
                disabled={disabled}
                input
                className="w-full"
                label={t(`automations.designer.scheduled_target_${triggerConfig.scheduled_target ?? "work_items"}`)}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
});
