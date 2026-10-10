// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { sortBy } from "lodash-es";
import { workItemFiltersAdapter } from "@plane/shared-state";
import { ISSUE_DISPLAY_PROPERTIES_KEYS, ISSUE_PRIORITIES, STATE_GROUPS } from "@plane/constants";
import type {
  EStartOfTheWeek,
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  TCalendarLayouts,
  TGanttViews,
  TIssueExtraOptions,
  TIssueGroupByOptions,
  TIssueOrderByOptions,
  TSupportedOperators,
  TTimelineColorBy,
  TWorkItemFilterConditionData,
  TWorkItemFilterConditionKey,
  TWorkItemFilterExpression,
  TWorkItemFilterExpressionData,
  TWorkItemFilterProperty,
} from "@plane/types";
import { EIssueLayoutTypes, LOGICAL_OPERATOR, WORK_ITEM_FILTER_PROPERTY_KEYS } from "@plane/types";
import { deepCompareFilterExpressions } from "@plane/utils";
import { CUSTOM_DISPLAY_PROPERTY_PREFIX } from "./types";
import type { TBuiltInDisplayProperty, TCustomDisplayProperty, TDisplayPropertyKey, TPeekRef } from "./types";

/** A parsed value; undefined means the raw string was invalid. */
export type TParsed<T> = { value: T } | undefined;

export type TCodec<T> = {
  parse: (raw: string) => TParsed<T>;
  format: (value: T) => string;
};

const hasKey = <K extends string>(record: Record<K, unknown>, key: string): key is K => Object.hasOwn(record, key);

const enumCodec = <T extends string>(names: Record<T, string>): TCodec<T> => {
  const byName = new Map<string, T>();
  for (const value of Object.keys(names)) {
    if (!hasKey(names, value)) continue;
    byName.set(value, value);
    byName.set(names[value], value);
  }
  return {
    parse: (raw) => {
      const value = byName.get(raw);
      return value === undefined ? undefined : { value };
    },
    format: (value) => names[value],
  };
};

const LAYOUT_NAMES: Record<EIssueLayoutTypes, string> = {
  [EIssueLayoutTypes.LIST]: "list",
  [EIssueLayoutTypes.KANBAN]: "kanban",
  [EIssueLayoutTypes.CALENDAR]: "calendar",
  [EIssueLayoutTypes.SPREADSHEET]: "table",
  [EIssueLayoutTypes.GANTT]: "timeline",
};

export const layoutCodec = enumCodec(LAYOUT_NAMES);

const GROUP_BY_NAMES: Record<Exclude<TIssueGroupByOptions, null>, string> = {
  state: "state",
  priority: "priority",
  labels: "labels",
  created_by: "created_by",
  "state_detail.group": "state_group",
  project: "project",
  assignees: "assignees",
  cycle: "cycle",
  module: "module",
  target_date: "target_date",
  team_project: "team_project",
};

const groupByNames = enumCodec(GROUP_BY_NAMES);

const GROUP_BY_NONE = "none";

export const groupByCodec: TCodec<TIssueGroupByOptions> = {
  parse: (raw) => (raw === GROUP_BY_NONE ? { value: null } : groupByNames.parse(raw)),
  format: (value) => (value === null ? GROUP_BY_NONE : groupByNames.format(value)),
};

const ORDER_BY_OPTIONS: Record<TIssueOrderByOptions, true> = {
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

export const orderByCodec: TCodec<TIssueOrderByOptions> = {
  parse: (raw) => (hasKey(ORDER_BY_OPTIONS, raw) ? { value: raw } : undefined),
  format: (value) => value,
};

export const calendarLayoutCodec = enumCodec<TCalendarLayouts>({ month: "month", week: "week" });

export const colorByCodec = enumCodec<TTimelineColorBy>({ state: "state", key: "key" });

export const DEFAULT_TIMELINE_ZOOM: TGanttViews = "month";

export const timelineZoomCodec = enumCodec<TGanttViews>({ week: "week", month: "month", quarter: "quarter" });

export const pqlCodec: TCodec<string> = {
  parse: (raw) => ({ value: raw.trim() }),
  format: (value) => value.trim(),
};

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDay = (raw: string): Date | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? date : undefined;
};

const isDay = (raw: string) => parseDay(raw) !== undefined;

/** Parses YYYY-MM (its first day) or YYYY-MM-DD into a YYYY-MM-DD anchor. */
export const parseCalendarAnchor = (raw: string): TParsed<string> => {
  const day = /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : raw;
  return isDay(day) ? { value: day } : undefined;
};

/** The month (YYYY-MM) or the first day of the week (YYYY-MM-DD) that shows the anchor. */
export const formatCalendarAnchor = (anchor: string, layout: TCalendarLayouts, weekStart: EStartOfTheWeek): string => {
  if (layout === "month") return anchor.slice(0, 7);
  const date = parseDay(anchor);
  if (!date) return anchor;
  const offset = (date.getUTCDay() - weekStart + 7) % 7;
  return new Date(date.getTime() - offset * DAY_MS).toISOString().slice(0, 10);
};

// Project identifiers as the project form allows them, upper-cased like the API stores them.
const PEEK_PATTERN = /^([A-Z0-9ÇĞİÖŞÜ]{1,12})-([0-9]+)$/;

export const peekCodec: TCodec<TPeekRef> = {
  parse: (raw) => {
    const match = PEEK_PATTERN.exec(raw.toUpperCase());
    if (!match) return undefined;
    const sequenceId = Number(match[2]);
    if (!Number.isSafeInteger(sequenceId) || sequenceId < 1) return undefined;
    return { value: { projectIdentifier: match[1], sequenceId } };
  },
  format: ({ projectIdentifier, sequenceId }) => `${projectIdentifier}-${sequenceId}`,
};

const OFF_PREFIX = "-";
const ON_PREFIX = "+";

/** Formats a sorted on/off diff list: `name` is on, `-name` is off. */
const formatDiffList = (entries: [string, boolean][]): string | undefined => {
  if (entries.length === 0) return undefined;
  return sortBy(entries, ([name]) => name)
    .map(([name, on]) => (on ? name : `${OFF_PREFIX}${name}`))
    .join(",");
};

type TDiffListEntry = { name: string; on: boolean };

const parseDiffList = (raw: string): TDiffListEntry[] =>
  raw.split(",").map((part) => {
    const token = part.trim();
    if (token.startsWith(OFF_PREFIX)) return { name: token.slice(1), on: false };
    if (token.startsWith(ON_PREFIX)) return { name: token.slice(1), on: true };
    return { name: token, on: true };
  });

/** Known entries, and the raw names of unknown or empty ones. */
export type TDiffParse<K extends string> = { values: Partial<Record<K, boolean>>; invalid: string[] };

export type TViewFlag = Extract<keyof IIssueDisplayFilterOptions, TIssueExtraOptions>;

const FLAG_NAMES: Record<TViewFlag, string> = {
  sub_issue: "sub",
  show_empty_groups: "empty",
  hierarchy: "tree",
};

const flagByName = new Map<string, TViewFlag>();
for (const flag of Object.keys(FLAG_NAMES)) if (hasKey(FLAG_NAMES, flag)) flagByName.set(FLAG_NAMES[flag], flag);

export const formatFlagDiff = (
  state: IIssueDisplayFilterOptions,
  baseline: IIssueDisplayFilterOptions,
  flags: readonly TViewFlag[]
): string | undefined =>
  formatDiffList(
    flags
      .filter((flag) => Boolean(state[flag]) !== Boolean(baseline[flag]))
      .map((flag) => [FLAG_NAMES[flag], Boolean(state[flag])])
  );

export const parseFlagDiff = (raw: string): TDiffParse<TViewFlag> => {
  const values: Partial<Record<TViewFlag, boolean>> = {};
  const invalid: string[] = [];
  for (const { name, on } of parseDiffList(raw)) {
    const flag = flagByName.get(name);
    if (flag) values[flag] = on;
    else invalid.push(name);
  }
  return { values, invalid };
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: string) => UUID_PATTERN.test(value);
const CUSTOM_PROPERTY_NAME_PREFIX = "cp.";
const CUSTOM_FILTER_PROPERTY_PREFIX = "customproperty_";

const BUILT_IN_DISPLAY_PROPERTIES = new Set<string>(ISSUE_DISPLAY_PROPERTIES_KEYS);

export const isBuiltInDisplayProperty = (name: string): name is TBuiltInDisplayProperty =>
  BUILT_IN_DISPLAY_PROPERTIES.has(name);

const isCustomDisplayProperty = (key: string): key is TCustomDisplayProperty =>
  key.startsWith(CUSTOM_DISPLAY_PROPERTY_PREFIX) && isUuid(key.slice(CUSTOM_DISPLAY_PROPERTY_PREFIX.length));

export const isCustomDisplayPropertyKey = isCustomDisplayProperty;

const customDisplayPropertyKeys = (properties: IIssueDisplayProperties) =>
  Object.keys(properties).filter(isCustomDisplayProperty);

export type TDisplayPropertyScope = {
  builtIn: readonly TBuiltInDisplayProperty[];
  custom: boolean;
};

export const formatDisplayPropertyDiff = (
  state: IIssueDisplayProperties,
  baseline: IIssueDisplayProperties,
  scope: TDisplayPropertyScope
): string | undefined => {
  const keys: TDisplayPropertyKey[] = [...scope.builtIn];
  if (scope.custom) {
    keys.push(...new Set([...customDisplayPropertyKeys(state), ...customDisplayPropertyKeys(baseline)]));
  }
  return formatDiffList(
    keys
      .filter((key) => Boolean(state[key]) !== Boolean(baseline[key]))
      .map((key) => [
        isCustomDisplayProperty(key)
          ? `${CUSTOM_PROPERTY_NAME_PREFIX}${key.slice(CUSTOM_DISPLAY_PROPERTY_PREFIX.length).toLowerCase()}`
          : key,
        Boolean(state[key]),
      ])
  );
};

export const parseDisplayPropertyDiff = (raw: string): TDiffParse<TDisplayPropertyKey> => {
  const values: Partial<Record<TDisplayPropertyKey, boolean>> = {};
  const invalid: string[] = [];
  for (const { name, on } of parseDiffList(raw)) {
    const custom = name.startsWith(CUSTOM_PROPERTY_NAME_PREFIX)
      ? `${CUSTOM_DISPLAY_PROPERTY_PREFIX}${name.slice(CUSTOM_PROPERTY_NAME_PREFIX.length).toLowerCase()}`
      : undefined;
    if (custom !== undefined && isCustomDisplayProperty(custom)) values[custom] = on;
    else if (custom === undefined && isBuiltInDisplayProperty(name)) values[name] = on;
    else invalid.push(name);
  }
  return { values, invalid };
};

const RICH_FILTERS_NONE = "none";
const RICH_FILTERS_JSON_PREFIX = "j.";
/** The API's default_max_depth for filter trees; the root is depth 1. */
const MAX_FILTER_DEPTH = 5;

type TValueKind = "uuid" | "date" | "priority" | "state_group" | "text" | "custom";

type TPropertyRule = { kind: TValueKind; operators: readonly TSupportedOperators[] };

const ID: TPropertyRule = { kind: "uuid", operators: ["exact", "in"] };
const DATE: TPropertyRule = { kind: "date", operators: ["exact", "range", "gt", "lt"] };
const CUSTOM: TPropertyRule = { kind: "custom", operators: ["exact", "in", "gt", "lt", "range", "icontains"] };

// Mirrors IssueFilterSet and the custom property filters of the API.
const PROPERTY_RULES: Record<(typeof WORK_ITEM_FILTER_PROPERTY_KEYS)[number], TPropertyRule> = {
  state_group: { kind: "state_group", operators: ["exact", "in"] },
  priority: { kind: "priority", operators: ["exact", "in"] },
  start_date: DATE,
  target_date: DATE,
  created_at: DATE,
  updated_at: DATE,
  completed_at: DATE,
  assignee_id: ID,
  mention_id: ID,
  created_by_id: ID,
  subscriber_id: ID,
  label_id: ID,
  state_id: ID,
  cycle_id: ID,
  module_id: ID,
  project_id: ID,
  issue_type_id: ID,
  ancestor_id: ID,
  parent_id: ID,
  name: { kind: "text", operators: ["icontains"] },
};

const MULTI_VALUE_OPERATORS = new Set<TSupportedOperators>(["in", "range"]);
const PRIORITIES = new Set<string>(ISSUE_PRIORITIES.map(({ key }) => key));
const STATE_GROUP_KEYS = new Set<string>(Object.keys(STATE_GROUPS));

const isFilterProperty = (property: string): property is TWorkItemFilterProperty =>
  hasKey(PROPERTY_RULES, property) ||
  (property.startsWith(CUSTOM_FILTER_PROPERTY_PREFIX) && isUuid(property.slice(CUSTOM_FILTER_PROPERTY_PREFIX.length)));

const ruleOf = (property: TWorkItemFilterProperty): TPropertyRule =>
  hasKey(PROPERTY_RULES, property) ? PROPERTY_RULES[property] : CUSTOM;

const isOperatorOf = (rule: TPropertyRule, operator: string): operator is TSupportedOperators =>
  rule.operators.some((allowed) => allowed === operator);

const isValueOfKind = (value: string, kind: TValueKind) => {
  switch (kind) {
    case "uuid":
      return isUuid(value);
    case "date":
      return isDay(value);
    case "priority":
      return PRIORITIES.has(value);
    case "state_group":
      return STATE_GROUP_KEYS.has(value);
    default:
      return value.trim().length > 0;
  }
};

/** The value in the form the API accepts, with list values trimmed and joined; undefined if invalid. */
const canonicalValue = (
  value: unknown,
  operator: TSupportedOperators,
  kind: TValueKind
): string | number | boolean | undefined => {
  if (typeof value === "number" || typeof value === "boolean") {
    return kind === "custom" && !MULTI_VALUE_OPERATORS.has(operator) ? value : undefined;
  }
  if (typeof value !== "string") return undefined;
  if (!MULTI_VALUE_OPERATORS.has(operator)) return isValueOfKind(value, kind) ? value : undefined;
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0 || (operator === "range" && parts.length !== 2)) return undefined;
  return parts.every((part) => isValueOfKind(part, kind)) ? parts.join(",") : undefined;
};

type TCondition = {
  property: TWorkItemFilterProperty;
  operator: TSupportedOperators;
  value: string | number | boolean;
};

const toCondition = (property: string, operator: string, value: unknown): TCondition | undefined => {
  if (!isFilterProperty(property)) return undefined;
  const rule = ruleOf(property);
  if (!isOperatorOf(rule, operator)) return undefined;
  const canonical = canonicalValue(value, operator, rule.kind);
  return canonical === undefined ? undefined : { property, operator, value: canonical };
};

const toConditionData = ({ property, operator, value }: TCondition): TWorkItemFilterConditionData => {
  const key: TWorkItemFilterConditionKey = `${property}__${operator}`;
  return { [key]: value };
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const conditionFromData = (data: unknown): TCondition | undefined => {
  if (!isPlainObject(data)) return undefined;
  const entries = Object.entries(data);
  if (entries.length !== 1) return undefined;
  const [key, value] = entries[0];
  const separator = key.lastIndexOf("__");
  if (separator <= 0) return undefined;
  return toCondition(key.slice(0, separator), key.slice(separator + 2), value);
};

/** A canonical copy of an expression the API and the filter UI accept; undefined if invalid. */
const canonicalExpression = (value: unknown, depth = 1): TWorkItemFilterExpressionData | undefined => {
  if (depth > MAX_FILTER_DEPTH || !isPlainObject(value)) return undefined;
  const keys = Object.keys(value);
  if (keys.length !== 1) return undefined;
  const inner = value[keys[0]];
  if (keys[0] === LOGICAL_OPERATOR.AND) {
    if (!Array.isArray(inner) || inner.length === 0) return undefined;
    const children: TWorkItemFilterExpressionData[] = [];
    for (const child of inner) {
      const canonical = canonicalExpression(child, depth + 1);
      if (!canonical) return undefined;
      children.push(canonical);
    }
    return { [LOGICAL_OPERATOR.AND]: children };
  }
  if (keys[0] === LOGICAL_OPERATOR.NOT) {
    // the filter UI only negates single conditions
    if (depth + 1 > MAX_FILTER_DEPTH) return undefined;
    const condition = conditionFromData(inner);
    return condition ? { [LOGICAL_OPERATOR.NOT]: toConditionData(condition) } : undefined;
  }
  const condition = conditionFromData(value);
  return condition ? toConditionData(condition) : undefined;
};

const isEmptyExpression = (
  expression: TWorkItemFilterExpression | null | undefined
): expression is Record<string, never> | null | undefined => !expression || Object.keys(expression).length === 0;

const toCompactProperty = (property: TWorkItemFilterProperty) =>
  property.startsWith(CUSTOM_FILTER_PROPERTY_PREFIX)
    ? `${CUSTOM_PROPERTY_NAME_PREFIX}${property.slice(CUSTOM_FILTER_PROPERTY_PREFIX.length)}`
    : property;

const fromCompactProperty = (token: string) =>
  token.startsWith(CUSTOM_PROPERTY_NAME_PREFIX)
    ? `${CUSTOM_FILTER_PROPERTY_PREFIX}${token.slice(CUSTOM_PROPERTY_NAME_PREFIX.length)}`
    : token;

const isCompactValue = (value: string, operator: TSupportedOperators) =>
  !/[;:]/.test(value) && (MULTI_VALUE_OPERATORS.has(operator) || !value.includes(","));

const toCompactItem = (item: TWorkItemFilterExpressionData): string | undefined => {
  const negated = LOGICAL_OPERATOR.NOT in item;
  const condition = conditionFromData(negated ? item[LOGICAL_OPERATOR.NOT] : item);
  if (!condition || typeof condition.value !== "string" || !isCompactValue(condition.value, condition.operator)) {
    return undefined;
  }
  return `${negated ? "!" : ""}${toCompactProperty(condition.property)}:${condition.operator}:${condition.value}`;
};

const fromCompactItem = (token: string): TWorkItemFilterExpressionData | undefined => {
  const negated = token.startsWith("!");
  const [property, operator, value, ...rest] = (negated ? token.slice(1) : token).split(":");
  if (rest.length > 0 || value === undefined) return undefined;
  const condition = toCondition(fromCompactProperty(property), operator, value);
  if (!condition || !isCompactValue(value, condition.operator)) return undefined;
  return negated ? { [LOGICAL_OPERATOR.NOT]: toConditionData(condition) } : toConditionData(condition);
};

const toBase64Url = (text: string) => {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (encoded: string): string | undefined => {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return undefined;
  try {
    const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
};

const topLevelItems = (expression: TWorkItemFilterExpressionData): TWorkItemFilterExpressionData[] =>
  LOGICAL_OPERATOR.AND in expression ? expression[LOGICAL_OPERATOR.AND] : [expression];

/**
 * Writes `none` for no filters, the compact grammar where it fits, and `j.<base64url(JSON)>` otherwise.
 * Undefined for an expression parseRichFilters would reject, e.g. a legacy `None` value.
 */
export const formatRichFilters = (expression: TWorkItemFilterExpression | null | undefined): string | undefined => {
  if (isEmptyExpression(expression)) return RICH_FILTERS_NONE;
  const canonical = canonicalExpression(expression);
  if (!canonical) return undefined;
  const items = topLevelItems(canonical).map(toCompactItem);
  if (items.every((item): item is string => item !== undefined)) return items.join(";");
  return `${RICH_FILTERS_JSON_PREFIX}${toBase64Url(JSON.stringify(canonical))}`;
};

export const parseRichFilters = (raw: string): TParsed<TWorkItemFilterExpression> => {
  if (raw === RICH_FILTERS_NONE) return { value: {} };
  if (raw.startsWith(RICH_FILTERS_JSON_PREFIX)) {
    const json = fromBase64Url(raw.slice(RICH_FILTERS_JSON_PREFIX.length));
    if (json === undefined) return undefined;
    try {
      const value = canonicalExpression(JSON.parse(json));
      return value ? { value } : undefined;
    } catch {
      return undefined;
    }
  }
  const items: TWorkItemFilterExpressionData[] = [];
  for (const token of raw.split(";")) {
    const item = fromCompactItem(token);
    if (!item) return undefined;
    items.push(item);
  }
  return { value: items.length === 1 ? items[0] : { [LOGICAL_OPERATOR.AND]: items } };
};

const unwrapSingleAnd = (expression: TWorkItemFilterExpressionData): TWorkItemFilterExpressionData =>
  LOGICAL_OPERATOR.AND in expression && expression[LOGICAL_OPERATOR.AND].length === 1
    ? unwrapSingleAnd(expression[LOGICAL_OPERATOR.AND][0])
    : expression;

const toComparable = (expression: TWorkItemFilterExpression | null | undefined) =>
  isEmptyExpression(expression) ? null : workItemFiltersAdapter.toInternal(unwrapSingleAnd(expression));

export const richFiltersEqual = (
  a: TWorkItemFilterExpression | null | undefined,
  b: TWorkItemFilterExpression | null | undefined
): boolean => deepCompareFilterExpressions(toComparable(a), toComparable(b));
