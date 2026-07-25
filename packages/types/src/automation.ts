/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * Types for the automation designer.
 *
 * The trigger, condition and action vocabulary is not hard-coded here: the API
 * serves it from `plane/automation/registry.py` via the metadata endpoint, and
 * `TAutomationMetadata` describes that payload. Only the persisted shapes and
 * the small set of literal unions that the UI branches on live in this file.
 */

export type TAutomationScope = "project" | "workspace";

export type TAutomationRunStatus = "success" | "failed" | "partial" | "skipped";

export type TAutomationRunTriggerSource = "event" | "schedule" | "manual";

/** Mirrors `registry.TriggerType`. */
export type TAutomationTriggerType =
  | "work_item.created"
  | "work_item.updated"
  | "work_item.deleted"
  | "work_item.state_changed"
  | "work_item.priority_changed"
  | "work_item.assignees_changed"
  | "work_item.labels_changed"
  | "work_item.target_date_changed"
  | "work_item.parent_changed"
  | "work_item.comment_created"
  | "work_item.added_to_cycle"
  | "work_item.added_to_module"
  | "schedule";

/** Mirrors `registry.ActionType`. */
export type TAutomationActionType =
  | "change_property"
  | "add_comment"
  | "send_notification"
  | "create_work_item"
  | "archive_work_item"
  | "call_webhook";

/** Mirrors `registry.Operator`. */
export type TAutomationOperator =
  | "eq"
  | "neq"
  | "in"
  | "not_in"
  | "contains"
  | "not_contains"
  | "is_empty"
  | "is_not_empty"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "changed"
  | "changed_to"
  | "changed_from"
  | "due_in_days"
  | "overdue_by_days"
  | "older_than_days";

export type TAutomationPropertyKind = "text" | "option" | "multi_option" | "date" | "number" | "boolean";

/** Where the designer fetches selectable values for a property. */
export type TAutomationValueSource =
  | "states"
  | "state_groups"
  | "priorities"
  | "members"
  | "labels"
  | "modules"
  | "cycles"
  | "projects"
  | "work_item_types"
  | "estimate_points"
  | null;

export type TAutomationChangeType = "set" | "add" | "remove" | "clear" | "shift_days";

export type TAutomationLogicalOperator = "and" | "or";

// -- condition tree ---------------------------------------------------------

export type TAutomationConditionValue = string | number | boolean | string[] | number[] | null;

export type TAutomationConditionLeaf = {
  type: "condition";
  /** Client-side identity for list rendering; the API ignores it. */
  id?: string;
  property: string;
  operator: TAutomationOperator;
  value?: TAutomationConditionValue;
};

export type TAutomationConditionGroup = {
  type: "group";
  id?: string;
  logical_operator: TAutomationLogicalOperator;
  children: TAutomationConditionNode[];
};

export type TAutomationConditionNode = TAutomationConditionLeaf | TAutomationConditionGroup;

// -- trigger configuration --------------------------------------------------

export type TAutomationScheduleMode = "fixed" | "cron";

export type TAutomationScheduleFrequency = "daily" | "weekly" | "monthly";

/**
 * What a scheduled run acts on. `work_items` sweeps every work item matching the
 * conditions; `project` fires once per target project (for rules that only create
 * work items, notify, or call a webhook).
 */
export type TAutomationScheduledTarget = "project" | "work_items";

export type TAutomationScheduleConfig = {
  mode: TAutomationScheduleMode;
  frequency?: TAutomationScheduleFrequency;
  /** Cron day numbering: 0 is Sunday through 6 for Saturday. */
  days_of_week?: number[];
  day_of_month?: number;
  hour?: number;
  minute?: number;
  timezone?: string;
  cron?: string;
  scheduled_target?: TAutomationScheduledTarget;
};

export type TAutomationTriggerConfig = TAutomationScheduleConfig | Record<string, unknown>;

// -- action configuration ---------------------------------------------------

/** An absolute ISO date, or an offset from the day the automation runs. */
export type TAutomationDateValue = string | { mode: "relative"; days: number };

export type TChangePropertyConfig = {
  property: string;
  change_type: TAutomationChangeType;
  value?: TAutomationConditionValue | TAutomationDateValue;
};

export type TAddCommentConfig = {
  comment_html: string;
};

export type TAutomationNotificationRecipient =
  | "assignees"
  | "created_by"
  | "actor"
  | "subscribers"
  | "project_admins"
  | "specific_members";

export type TSendNotificationConfig = {
  recipients: TAutomationNotificationRecipient[];
  member_ids?: string[];
  title?: string;
  message?: string;
};

export type TCreateWorkItemConfig = {
  name: string;
  description_html?: string;
  project_id?: string;
  state_id?: string;
  priority?: string;
  assignee_ids?: string[];
  label_ids?: string[];
  target_date?: TAutomationDateValue;
  link_to_trigger_work_item?: boolean;
};

export type TCallWebhookConfig = {
  url: string;
  method?: "POST" | "PUT" | "PATCH";
  headers?: Record<string, string>;
  payload?: string;
};

export type TAutomationActionConfig =
  | TChangePropertyConfig
  | TAddCommentConfig
  | TSendNotificationConfig
  | TCreateWorkItemConfig
  | TCallWebhookConfig
  | Record<string, never>;

// -- persisted entities -----------------------------------------------------

export type TAutomationAction = {
  id: string;
  automation: string;
  action_type: TAutomationActionType;
  config: TAutomationActionConfig;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type TAutomationRunStep = {
  action_id: string;
  action_type: TAutomationActionType;
  status: "success" | "failed" | "skipped";
  detail: string;
  error: string;
};

export type TAutomationRun = {
  id: string;
  automation: string;
  project: string | null;
  status: TAutomationRunStatus;
  trigger_source: TAutomationRunTriggerSource;
  trigger_type: string;
  entity_type: string;
  entity_identifier: string | null;
  initiator: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number;
  processed_count: number;
  steps: TAutomationRunStep[];
  error: string;
};

export type TAutomation = {
  id: string;
  workspace: string;
  project: string | null;
  scope: TAutomationScope;
  applies_to_all_projects: boolean;
  /** Project ids this automation runs on; empty when it covers the workspace. */
  projects: string[];
  name: string;
  description: string;
  trigger_type: TAutomationTriggerType | "";
  trigger_config: TAutomationTriggerConfig;
  condition: TAutomationConditionNode | null;
  is_enabled: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_status: TAutomationRunStatus | null;
  total_run_count: number;
  failed_run_count: number;
  average_duration_ms: number | null;
  /** Human-readable schedule summary; null for event triggers. */
  schedule_summary: string | null;
  owned_by: string | null;
  actions: TAutomationAction[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type TAutomationPayload = Partial<
  Pick<
    TAutomation,
    "name" | "description" | "trigger_type" | "trigger_config" | "condition" | "is_enabled" | "applies_to_all_projects"
  >
> & {
  project_ids?: string[];
};

export type TAutomationActionPayload = {
  action_type?: TAutomationActionType;
  config?: TAutomationActionConfig;
  sort_order?: number;
};

// -- metadata catalog -------------------------------------------------------

export type TAutomationTriggerDefinition = {
  key: TAutomationTriggerType;
  i18n_label: string;
  group: "plane_events" | "time_based";
  entity: "work_item" | null;
  changed_field: string | null;
  allowed_actions: TAutomationActionType[];
};

export type TAutomationConditionPropertyDefinition = {
  key: string;
  i18n_label: string;
  kind: TAutomationPropertyKind;
  source: TAutomationValueSource;
  operators: TAutomationOperator[];
};

export type TAutomationMutablePropertyDefinition = {
  key: string;
  i18n_label: string;
  kind: TAutomationPropertyKind;
  source: TAutomationValueSource;
  change_types: TAutomationChangeType[];
};

export type TAutomationActionDefinition = {
  key: TAutomationActionType;
  i18n_label: string;
  requires_entity: boolean;
};

export type TAutomationMetadata = {
  triggers: TAutomationTriggerDefinition[];
  condition_properties: TAutomationConditionPropertyDefinition[];
  mutable_properties: TAutomationMutablePropertyDefinition[];
  actions: TAutomationActionDefinition[];
  notification_recipients: TAutomationNotificationRecipient[];
  template_variables: string[];
};
