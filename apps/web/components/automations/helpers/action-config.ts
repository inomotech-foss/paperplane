/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type {
  TAutomationActionConfig,
  TAutomationConditionValue,
  TCallWebhookConfig,
  TChangePropertyConfig,
  TCreateWorkItemConfig,
  TSendNotificationConfig,
} from "@plane/types";

const isStringOrNumberArray = (value: unknown[]): value is string[] | number[] =>
  value.every((item) => typeof item === "string") || value.every((item) => typeof item === "number");

export const isConditionValue = (value: unknown): value is TAutomationConditionValue =>
  value === null ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  (Array.isArray(value) && isStringOrNumberArray(value));

export const toChangePropertyConfig = (config: TAutomationActionConfig): TChangePropertyConfig => ({
  ...config,
  property: "property" in config ? config.property : "",
  change_type: "change_type" in config ? config.change_type : "set",
});

export const toSendNotificationConfig = (config: TAutomationActionConfig): TSendNotificationConfig => ({
  ...config,
  recipients: ("recipients" in config ? config.recipients : undefined) ?? [],
});

export const toCreateWorkItemConfig = (config: TAutomationActionConfig): TCreateWorkItemConfig => ({
  ...config,
  name: ("name" in config ? config.name : undefined) ?? "",
});

export const toCallWebhookConfig = (config: TAutomationActionConfig): TCallWebhookConfig => ({
  ...config,
  url: ("url" in config ? config.url : undefined) ?? "",
});

export const getCommentHtml = (config: TAutomationActionConfig): string =>
  ("comment_html" in config ? config.comment_html : undefined) ?? "";
