// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type {
  TAutomationActionConfig,
  TAutomationActionType,
  TAutomationChangeType,
  TAutomationConditionNode,
  TAutomationConditionValue,
  TAutomationDateValue,
  TAutomationNotificationRecipient,
  TAutomationOperator,
  TAutomationRunStep,
  TAutomationTriggerConfig,
} from "./automation";
import { findLiteral, isNumberArray, isRecord, isStringArray } from "./narrow";

// The API checks these JSON fields with `plane/automation/validators.py` before it stores them. The parsers accept what
// those validators accept and keep the keys they do not know. A value they still cannot read gives `undefined`, so the
// caller can keep the raw value and show it read-only instead of writing back a reset.

const OPERATORS: readonly TAutomationOperator[] = [
  "eq",
  "neq",
  "in",
  "not_in",
  "contains",
  "not_contains",
  "is_empty",
  "is_not_empty",
  "gt",
  "gte",
  "lt",
  "lte",
  "changed",
  "changed_to",
  "changed_from",
  "due_in_days",
  "overdue_by_days",
  "older_than_days",
];

const CHANGE_TYPES: readonly TAutomationChangeType[] = ["set", "add", "remove", "clear", "shift_days"];

const RECIPIENTS: readonly TAutomationNotificationRecipient[] = [
  "assignees",
  "created_by",
  "actor",
  "subscribers",
  "project_admins",
  "specific_members",
];

const WEBHOOK_METHODS = ["POST", "PUT", "PATCH"] as const;

/** The same nesting limit as the backend. */
const MAX_CONDITION_DEPTH = 6;

const isConditionValue = (value: unknown): value is TAutomationConditionValue =>
  value === null ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  isStringArray(value) ||
  isNumberArray(value);

const isDateValue = (value: unknown): value is TAutomationDateValue =>
  typeof value === "string" || (isRecord(value) && value.mode === "relative" && typeof value.days === "number");

/** An optional string field. Null and absent both read as absent, as the backend treats them. */
const optionalString = (value: unknown): { ok: boolean; value?: string } => {
  if (value === undefined || value === null) return { ok: true };
  return typeof value === "string" ? { ok: true, value } : { ok: false };
};

const optionalStrings = (value: unknown): { ok: boolean; value?: string[] } => {
  if (value === undefined || value === null) return { ok: true };
  return isStringArray(value) ? { ok: true, value } : { ok: false };
};

function parseNode(value: unknown, depth: number): TAutomationConditionNode | undefined {
  if (!isRecord(value) || depth > MAX_CONDITION_DEPTH) return undefined;
  const type = value.type ?? "group";
  if (type === "group") {
    const logicalOperator = findLiteral(["and", "or"], String(value.logical_operator ?? "and").toLowerCase());
    const rawChildren = value.children ?? [];
    if (!logicalOperator || !Array.isArray(rawChildren)) return undefined;
    const children: TAutomationConditionNode[] = [];
    for (const child of rawChildren) {
      const node = parseNode(child, depth + 1);
      if (!node) return undefined;
      children.push(node);
    }
    const id = optionalString(value.id);
    if (!id.ok) return undefined;
    return {
      ...value,
      type: "group",
      ...(id.value === undefined ? {} : { id: id.value }),
      logical_operator: logicalOperator,
      children,
    };
  }
  if (type !== "condition") return undefined;
  const operator = findLiteral(OPERATORS, value.operator);
  const id = optionalString(value.id);
  if (typeof value.property !== "string" || !operator || !id.ok) return undefined;
  if (value.value !== undefined && !isConditionValue(value.value)) return undefined;
  return {
    ...value,
    type: "condition",
    ...(id.value === undefined ? {} : { id: id.value }),
    property: value.property,
    operator,
    ...(value.value === undefined ? {} : { value: value.value }),
  };
}

/** The condition tree of an automation: null for none, undefined when the client cannot read it. */
export function parseAutomationCondition(value: unknown): TAutomationConditionNode | null | undefined {
  if (value === null || value === undefined) return null;
  return parseNode(value, 0);
}

/** The trigger configuration. Its keys depend on the trigger, so any object is kept as it is. */
export const parseAutomationTriggerConfig = (value: unknown): TAutomationTriggerConfig =>
  isRecord(value) ? value : {};

function parseChangeProperty(config: Record<string, unknown>): TAutomationActionConfig | undefined {
  const changeType = findLiteral(CHANGE_TYPES, config.change_type ?? "set");
  if (typeof config.property !== "string" || !changeType) return undefined;
  const value = config.value;
  if (value !== undefined && !isConditionValue(value) && !isDateValue(value)) return undefined;
  return {
    ...config,
    property: config.property,
    change_type: changeType,
    ...(value === undefined ? {} : { value }),
  };
}

function parseAddComment(config: Record<string, unknown>): TAutomationActionConfig | undefined {
  const comment = optionalString(config.comment_html);
  return comment.ok ? { ...config, comment_html: comment.value ?? "" } : undefined;
}

function parseNotification(config: Record<string, unknown>): TAutomationActionConfig | undefined {
  const rawRecipients = config.recipients ?? [];
  if (!Array.isArray(rawRecipients)) return undefined;
  const recipients: TAutomationNotificationRecipient[] = [];
  for (const item of rawRecipients) {
    const recipient = findLiteral(RECIPIENTS, item);
    if (!recipient) return undefined;
    recipients.push(recipient);
  }
  const memberIds = optionalStrings(config.member_ids);
  const title = optionalString(config.title);
  const message = optionalString(config.message);
  if (!memberIds.ok || !title.ok || !message.ok) return undefined;
  const { member_ids: _memberIds, title: _title, message: _message, ...rest } = config;
  return {
    ...rest,
    recipients,
    ...(memberIds.value === undefined ? {} : { member_ids: memberIds.value }),
    ...(title.value === undefined ? {} : { title: title.value }),
    ...(message.value === undefined ? {} : { message: message.value }),
  };
}

function parseCreateWorkItem(config: Record<string, unknown>): TAutomationActionConfig | undefined {
  const strings = ["name", "description_html", "project_id", "type_id", "state_id", "priority"] as const;
  const parsed: Record<string, unknown> = { ...config };
  for (const key of strings) {
    const field = optionalString(config[key]);
    if (!field.ok) return undefined;
    if (field.value === undefined) delete parsed[key];
    else parsed[key] = field.value;
  }
  for (const key of ["assignee_ids", "label_ids"] as const) {
    const field = optionalStrings(config[key]);
    if (!field.ok) return undefined;
    if (field.value === undefined) delete parsed[key];
  }
  const targetDate = config.target_date;
  if (targetDate !== undefined && targetDate !== null && !isDateValue(targetDate)) return undefined;
  if (targetDate === null) delete parsed.target_date;
  const link = config.link_to_trigger_work_item;
  if (link !== undefined && link !== null && typeof link !== "boolean") return undefined;
  if (link === null) delete parsed.link_to_trigger_work_item;
  const assigneeIds = optionalStrings(config.assignee_ids).value;
  const labelIds = optionalStrings(config.label_ids).value;
  const name = optionalString(config.name).value ?? "";
  return {
    ...parsed,
    name,
    ...(assigneeIds === undefined ? {} : { assignee_ids: assigneeIds }),
    ...(labelIds === undefined ? {} : { label_ids: labelIds }),
    ...(isDateValue(targetDate) ? { target_date: targetDate } : {}),
    ...(typeof link === "boolean" ? { link_to_trigger_work_item: link } : {}),
  };
}

function parseWebhook(config: Record<string, unknown>): TAutomationActionConfig | undefined {
  const url = optionalString(config.url);
  const payload = optionalString(config.payload);
  const rawMethod = config.method;
  const method =
    rawMethod === undefined || rawMethod === null
      ? undefined
      : typeof rawMethod === "string"
        ? findLiteral(WEBHOOK_METHODS, rawMethod.toUpperCase())
        : undefined;
  const rawHeaders = config.headers;
  if (!url.ok || !payload.ok) return undefined;
  if (rawMethod !== undefined && rawMethod !== null && !method) return undefined;
  if (rawHeaders !== undefined && rawHeaders !== null && !isRecord(rawHeaders)) return undefined;
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(isRecord(rawHeaders) ? rawHeaders : {})) {
    // The designer edits header values as text, so a stored number or object stays read-only.
    if (typeof value !== "string") return undefined;
    headers[key] = value;
  }
  const { method: _method, headers: _headers, payload: _payload, ...rest } = config;
  return {
    ...rest,
    url: url.value ?? "",
    ...(method === undefined ? {} : { method }),
    ...(isRecord(rawHeaders) ? { headers } : {}),
    ...(payload.value === undefined ? {} : { payload: payload.value }),
  };
}

/**
 * The configuration of an action, or undefined when the client cannot read it. An archive action takes no
 * configuration, so one that has keys is left to the raw value too.
 */
export function parseAutomationActionConfig(
  actionType: TAutomationActionType,
  value: unknown
): TAutomationActionConfig | undefined {
  const config = value === null || value === undefined ? {} : value;
  if (!isRecord(config)) return undefined;
  switch (actionType) {
    case "change_property":
      return parseChangeProperty(config);
    case "add_comment":
      return parseAddComment(config);
    case "send_notification":
      return parseNotification(config);
    case "create_work_item":
      return parseCreateWorkItem(config);
    case "call_webhook":
      return parseWebhook(config);
    case "archive_work_item":
      return Object.keys(config).length === 0 ? {} : undefined;
  }
}

const RUN_STATUSES = ["success", "failed", "skipped"] as const;
const ACTION_TYPES: readonly TAutomationActionType[] = [
  "change_property",
  "add_comment",
  "send_notification",
  "create_work_item",
  "archive_work_item",
  "call_webhook",
];

/** The steps of a run. A step the client cannot read is left out, as runs are never written back. */
export function parseAutomationRunSteps(value: unknown): TAutomationRunStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown): TAutomationRunStep[] => {
    if (!isRecord(item) || typeof item.action_id !== "string") return [];
    const actionType = findLiteral(ACTION_TYPES, item.action_type);
    const status = findLiteral(RUN_STATUSES, item.status);
    if (!actionType || !status) return [];
    return [
      {
        action_id: item.action_id,
        action_type: actionType,
        status,
        detail: typeof item.detail === "string" ? item.detail : "",
        error: typeof item.error === "string" ? item.error : "",
      },
    ];
  });
}
