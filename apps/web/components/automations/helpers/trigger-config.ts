/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TAutomationScheduleConfig, TAutomationTriggerConfig } from "@plane/types";
import { isString } from "@/helpers/narrow.helper";

const isOptional = (value: unknown, check: (value: unknown) => boolean): boolean => value === undefined || check(value);

const isNumber = (value: unknown): boolean => typeof value === "number";

export const isScheduleConfig = (config: TAutomationTriggerConfig): config is TAutomationScheduleConfig =>
  (config.mode === "fixed" || config.mode === "cron") &&
  isOptional(config.frequency, (value) => value === "daily" || value === "weekly" || value === "monthly") &&
  isOptional(config.days_of_week, (value) => Array.isArray(value) && value.every(isNumber)) &&
  isOptional(config.day_of_month, isNumber) &&
  isOptional(config.hour, isNumber) &&
  isOptional(config.minute, isNumber) &&
  isOptional(config.timezone, isString) &&
  isOptional(config.cron, isString) &&
  isOptional(config.scheduled_target, (value) => value === "project" || value === "work_items");
