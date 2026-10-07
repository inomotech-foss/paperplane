// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { EIssueFilterType } from "@plane/constants";
import type {
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  TCalendarLayouts,
  TIssueGroupByOptions,
  TIssueKanbanFilters,
  TIssueOrderByOptions,
  TSupportedOperators,
  TTimelineColorBy,
  TWorkItemFilterConditionKey,
  TWorkItemFilterExpression,
  TWorkItemFilterExpressionData,
} from "@plane/types";
import {
  CORE_OPERATORS,
  EIssueLayoutTypes,
  EIssuesStoreType,
  EXTENDED_OPERATORS,
  LOGICAL_OPERATOR,
  WORK_ITEM_FILTER_PROPERTY_KEYS,
} from "@plane/types";

export type TLocalIssueFilters = {
  [EIssueFilterType.FILTERS]?: TWorkItemFilterExpression;
  [EIssueFilterType.DISPLAY_FILTERS]?: IIssueDisplayFilterOptions;
  [EIssueFilterType.DISPLAY_PROPERTIES]?: IIssueDisplayProperties;
  [EIssueFilterType.KANBAN_FILTERS]?: TIssueKanbanFilters;
};

export interface ILocalStoreIssueFilters {
  key: EIssuesStoreType;
  workspaceSlug: string;
  // projectId, moduleId, cycleId or projectViewId
  viewId: string | undefined;
  userId: string | undefined;
  filters: TLocalIssueFilters;
}

const ORDER_BY: Record<TIssueOrderByOptions, true> = {
  "-created_at": true,
  created_at: true,
  updated_at: true,
  "-updated_at": true,
  priority: true,
  "-priority": true,
  sort_order: true,
  state__name: true,
  "-state__name": true,
  assignees__first_name: true,
  "-assignees__first_name": true,
  labels__name: true,
  "-labels__name": true,
  issue_module__module__name: true,
  "-issue_module__module__name": true,
  issue_cycle__cycle__name: true,
  "-issue_cycle__cycle__name": true,
  target_date: true,
  "-target_date": true,
  estimate_point__key: true,
  "-estimate_point__key": true,
  start_date: true,
  "-start_date": true,
  link_count: true,
  "-link_count": true,
  attachment_count: true,
  "-attachment_count": true,
  sub_issues_count: true,
  "-sub_issues_count": true,
};

const GROUP_BY: Record<NonNullable<TIssueGroupByOptions>, true> = {
  state: true,
  priority: true,
  labels: true,
  created_by: true,
  "state_detail.group": true,
  project: true,
  assignees: true,
  cycle: true,
  module: true,
  target_date: true,
  team_project: true,
};

const CALENDAR_LAYOUTS: Record<TCalendarLayouts, true> = { month: true, week: true };

const COLOR_BY: Record<TTimelineColorBy, true> = { state: true, key: true };

const DISPLAY_PROPERTY_KEYS: Record<Exclude<keyof IIssueDisplayProperties, `custom_property_${string}`>, true> = {
  assignee: true,
  start_date: true,
  due_date: true,
  labels: true,
  key: true,
  priority: true,
  state: true,
  sub_issue_count: true,
  link: true,
  attachment_count: true,
  estimate: true,
  created_on: true,
  updated_on: true,
  modules: true,
  cycle: true,
  issue_type: true,
};

const OPERATORS: readonly TSupportedOperators[] = [
  ...Object.values(CORE_OPERATORS),
  ...Object.values(EXTENDED_OPERATORS),
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

const isKeyOf = <T extends string>(record: Record<T, true>, value: unknown): value is T =>
  typeof value === "string" && Object.hasOwn(record, value);

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  values.some((item) => item === value);

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === "string";

const isFilterConditionKey = (key: string): key is TWorkItemFilterConditionKey => {
  const separator = key.lastIndexOf("__");
  if (separator <= 0) return false;
  const property = key.slice(0, separator);
  const operator = key.slice(separator + 2);
  const isProperty =
    isOneOf(WORK_ITEM_FILTER_PROPERTY_KEYS, property) ||
    (property.startsWith("customproperty_") && property.length > "customproperty_".length);
  return isProperty && isOneOf(OPERATORS, operator);
};

const isFilterExpressionData = (value: unknown): value is TWorkItemFilterExpressionData => {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return false;
  if (keys.length === 1 && keys[0] === LOGICAL_OPERATOR.AND) {
    const children = value[LOGICAL_OPERATOR.AND];
    return isArray(children) && children.length > 0 && children.every(isFilterExpressionData);
  }
  if (keys.length === 1 && keys[0] === LOGICAL_OPERATOR.NOT) return isFilterExpressionData(value[LOGICAL_OPERATOR.NOT]);
  return Object.entries(value).every(
    ([key, condition]) => isFilterConditionKey(key) && ["string", "number", "boolean"].includes(typeof condition)
  );
};

const parseFilterExpression = (value: unknown): TWorkItemFilterExpression | undefined => {
  if (isRecord(value) && Object.keys(value).length === 0) return {};
  return isFilterExpressionData(value) ? value : undefined;
};

const parseDisplayFilters = (value: unknown): IIssueDisplayFilterOptions | undefined => {
  if (!isRecord(value)) return undefined;
  const result: IIssueDisplayFilterOptions = {};
  if (isRecord(value.calendar)) {
    const { show_weekends, layout } = value.calendar;
    result.calendar = {};
    if (typeof show_weekends === "boolean") result.calendar.show_weekends = show_weekends;
    if (isKeyOf(CALENDAR_LAYOUTS, layout)) result.calendar.layout = layout;
  }
  const { group_by, sub_group_by, layout, order_by, show_empty_groups, sub_issue, hierarchy, pql, color_by } = value;
  if (group_by === null || isKeyOf(GROUP_BY, group_by)) result.group_by = group_by;
  if (sub_group_by === null || isKeyOf(GROUP_BY, sub_group_by)) result.sub_group_by = sub_group_by;
  if (isOneOf(Object.values(EIssueLayoutTypes), layout)) result.layout = layout;
  if (isKeyOf(ORDER_BY, order_by)) result.order_by = order_by;
  if (typeof show_empty_groups === "boolean") result.show_empty_groups = show_empty_groups;
  if (typeof sub_issue === "boolean") result.sub_issue = sub_issue;
  if (typeof hierarchy === "boolean") result.hierarchy = hierarchy;
  if (typeof pql === "string") result.pql = pql;
  if (isKeyOf(COLOR_BY, color_by)) result.color_by = color_by;
  return result;
};

const isDisplayPropertyKey = (key: string): key is keyof IIssueDisplayProperties =>
  key.startsWith("custom_property_") || isKeyOf(DISPLAY_PROPERTY_KEYS, key);

const parseDisplayProperties = (value: unknown): IIssueDisplayProperties | undefined => {
  if (!isRecord(value)) return undefined;
  const result: IIssueDisplayProperties = {};
  for (const [key, enabled] of Object.entries(value)) {
    if (isDisplayPropertyKey(key) && typeof enabled === "boolean") result[key] = enabled;
  }
  return result;
};

const parseStringArray = (value: unknown): string[] =>
  isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const parseKanbanFilters = (value: unknown): TIssueKanbanFilters | undefined => {
  if (!isRecord(value)) return undefined;
  return { group_by: parseStringArray(value.group_by), sub_group_by: parseStringArray(value.sub_group_by) };
};

const parseFilters = (value: Record<string, unknown>): TLocalIssueFilters => {
  const result: TLocalIssueFilters = {};
  const richFilters = parseFilterExpression(value[EIssueFilterType.FILTERS]);
  const displayFilters = parseDisplayFilters(value[EIssueFilterType.DISPLAY_FILTERS]);
  const displayProperties = parseDisplayProperties(value[EIssueFilterType.DISPLAY_PROPERTIES]);
  const kanbanFilters = parseKanbanFilters(value[EIssueFilterType.KANBAN_FILTERS]);
  if (richFilters) result[EIssueFilterType.FILTERS] = richFilters;
  if (displayFilters) result[EIssueFilterType.DISPLAY_FILTERS] = displayFilters;
  if (displayProperties) result[EIssueFilterType.DISPLAY_PROPERTIES] = displayProperties;
  if (kanbanFilters) result[EIssueFilterType.KANBAN_FILTERS] = kanbanFilters;
  return result;
};

const parseEntry = (value: unknown): ILocalStoreIssueFilters | undefined => {
  if (!isRecord(value)) return undefined;
  const { key, workspaceSlug, viewId, userId, filters } = value;
  if (
    !isOneOf(Object.values(EIssuesStoreType), key) ||
    typeof workspaceSlug !== "string" ||
    !isOptionalString(viewId) ||
    !isOptionalString(userId) ||
    !isRecord(filters)
  )
    return undefined;
  return { key, workspaceSlug, viewId, userId, filters: parseFilters(filters) };
};

/** Parses the stored filters, dropping anything that does not match the expected shape. */
export const parseLocalIssueFilters = (raw: string | undefined): ILocalStoreIssueFilters[] => {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!isArray(data)) return [];
  return data.flatMap((entry) => parseEntry(entry) ?? []);
};
