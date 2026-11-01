// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { z } from "zod";
import type {
  TAutomationActionConfig,
  TAutomationActionType,
  TAutomationConditionNode,
  TAutomationRunStep,
  TAutomationTriggerConfig,
} from "./automation";
import { isPlainObject, warnClientJson } from "./client-json/parse";

// The API validates these JSON fields against its automation registry before it stores them. The parsers narrow what
// it sends back and skip the parts this client does not understand, so a newer backend does not break the designer.

const OPERATORS = [
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
] as const;

const conditionValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.array(z.number()),
  z.null(),
]);

const conditionNodeSchema: z.ZodType<TAutomationConditionNode> = z.lazy(() =>
  z.union([
    z.looseObject({
      type: z.literal("condition"),
      id: z.string().optional(),
      property: z.string(),
      operator: z.enum(OPERATORS),
      value: conditionValueSchema.optional(),
    }),
    z.looseObject({
      type: z.literal("group"),
      id: z.string().optional(),
      logical_operator: z.enum(["and", "or"]),
      children: z.array(conditionNodeSchema),
    }),
  ])
);

/** The condition tree of an automation, or null when it has none or the client cannot read it. */
export function parseAutomationCondition(value: unknown): TAutomationConditionNode | null {
  if (value === null || value === undefined) return null;
  const result = conditionNodeSchema.safeParse(value);
  if (result.success) return result.data;
  warnClientJson("automation condition", result.error.issues);
  return null;
}

/** The trigger configuration. Its keys depend on the trigger, so any object is kept as it is. */
export const parseAutomationTriggerConfig = (value: unknown): TAutomationTriggerConfig =>
  isPlainObject(value) ? value : {};

const dateValueSchema = z.union([z.string(), z.looseObject({ mode: z.literal("relative"), days: z.number() })]);

const ACTION_CONFIG_SCHEMAS: Record<TAutomationActionType, z.ZodType<TAutomationActionConfig>> = {
  change_property: z.looseObject({
    property: z.string(),
    change_type: z.enum(["set", "add", "remove", "clear", "shift_days"]),
    value: z.union([conditionValueSchema, dateValueSchema]).optional(),
  }),
  add_comment: z.looseObject({ comment_html: z.string() }),
  send_notification: z.looseObject({
    recipients: z.array(
      z.enum(["assignees", "created_by", "actor", "subscribers", "project_admins", "specific_members"])
    ),
    member_ids: z.array(z.string()).optional(),
    title: z.string().optional(),
    message: z.string().optional(),
  }),
  create_work_item: z.looseObject({
    name: z.string(),
    description_html: z.string().optional(),
    project_id: z.string().optional(),
    type_id: z.string().optional(),
    state_id: z.string().optional(),
    priority: z.string().optional(),
    assignee_ids: z.array(z.string()).optional(),
    label_ids: z.array(z.string()).optional(),
    target_date: dateValueSchema.optional(),
    link_to_trigger_work_item: z.boolean().optional(),
  }),
  archive_work_item: z.object({}).transform((): Record<string, never> => ({})),
  call_webhook: z.looseObject({
    url: z.string(),
    method: z.enum(["POST", "PUT", "PATCH"]).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    payload: z.string().optional(),
  }),
};

/** The configuration of an action. A configuration the client cannot read is empty, as for a new action. */
export function parseAutomationActionConfig(
  actionType: TAutomationActionType,
  value: unknown
): TAutomationActionConfig {
  const result = ACTION_CONFIG_SCHEMAS[actionType].safeParse(value ?? {});
  if (result.success) return result.data;
  warnClientJson(`${actionType} action config`, result.error.issues);
  return {};
}

const runStepSchema = z.looseObject({
  action_id: z.string(),
  action_type: z.enum([
    "change_property",
    "add_comment",
    "send_notification",
    "create_work_item",
    "archive_work_item",
    "call_webhook",
  ]),
  status: z.enum(["success", "failed", "skipped"]),
  detail: z.string().catch(""),
  error: z.string().catch(""),
});

/** The steps of a run. A step the client cannot read is left out. */
export function parseAutomationRunSteps(value: unknown): TAutomationRunStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    const result = runStepSchema.safeParse(item);
    return result.success ? [result.data] : [];
  });
}
