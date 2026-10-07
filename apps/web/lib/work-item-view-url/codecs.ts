// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { sortBy } from "lodash-es";
import { workItemFiltersAdapter } from "@plane/shared-state";
import { ISSUE_DISPLAY_PROPERTIES_KEYS } from "@plane/constants";
import type {
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  TCalendarLayouts,
  TGanttViews,
  TIssueExtraOptions,
  TIssueGroupByOptions,
  TIssueOrderByOptions,
  TTimelineColorBy,
  TWorkItemFilterConditionData,
  TWorkItemFilterExpression,
  TWorkItemFilterExpressionData,
} from "@plane/types";
import {
  CORE_OPERATORS,
  EIssueLayoutTypes,
  EXTENDED_OPERATORS,
  LOGICAL_OPERATOR,
  MULTI_VALUE_OPERATORS,
  WORK_ITEM_FILTER_PROPERTY_KEYS,
} from "@plane/types";
import { deepCompareFilterExpressions } from "@plane/utils";
import type { TPeekRef } from "./types";

/** A parsed value; undefined means the raw string was invalid. */
export type TParsed<T> = { value: T } | undefined;

export type TCodec<T> = {
  parse: (raw: string) => TParsed<T>;
  format: (value: T) => string;
};

const hasKey = <K extends string>(record: Record<K, unknown>, key: string): key is K => Object.hasOwn(record, key);

const enumCodec = <T extends string>(names: Record<T, string>): TCodec<T> => {
  const byName = new Map<string, T>();
  for (const value of Object.keys(names) as T[]) {
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

export const GROUP_BY_NONE = "none";

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

const isValidDate = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

/** Parses YYYY-MM or YYYY-MM-DD into a YYYY-MM-DD anchor. */
export const parseCalendarAnchor = (raw: string): TParsed<string> => {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(raw);
  if (!match) return undefined;
  const [, year, month, day = "01"] = match;
  if (!isValidDate(Number(year), Number(month), Number(day))) return undefined;
  return { value: `${year}-${month}-${day}` };
};

export const formatCalendarAnchor = (anchor: string, layout: TCalendarLayouts): string =>
  layout === "month" ? anchor.slice(0, 7) : anchor;

export const peekCodec: TCodec<TPeekRef> = {
  parse: (raw) => {
    const match = /^([\p{L}\p{N}]+)-(\d+)$/u.exec(raw);
    if (!match) return undefined;
    const sequenceId = Number(match[2]);
    if (!Number.isSafeInteger(sequenceId) || sequenceId < 1) return undefined;
    return { value: { projectIdentifier: match[1].toUpperCase(), sequenceId } };
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
  raw
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => {
      if (token.startsWith(OFF_PREFIX)) return { name: token.slice(1), on: false };
      if (token.startsWith(ON_PREFIX)) return { name: token.slice(1), on: true };
      return { name: token, on: true };
    });

export type TDiffParse<T> = { values: T; invalid: string[] };

export type TViewFlag = Extract<keyof IIssueDisplayFilterOptions, TIssueExtraOptions>;

const FLAG_NAMES: Record<TViewFlag, string> = {
  sub_issue: "sub",
  show_empty_groups: "empty",
  hierarchy: "tree",
};

const flagByName = new Map(Object.entries(FLAG_NAMES).map(([flag, name]) => [name, flag as TViewFlag]));

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

export const parseFlagDiff = (
  raw: string,
  flags: readonly TViewFlag[]
): TDiffParse<Partial<Record<TViewFlag, boolean>>> => {
  const applicable = new Set(flags);
  const values: Partial<Record<TViewFlag, boolean>> = {};
  const invalid: string[] = [];
  for (const { name, on } of parseDiffList(raw)) {
    const flag = flagByName.get(name);
    if (flag && applicable.has(flag)) values[flag] = on;
    else invalid.push(name);
  }
  return { values, invalid };
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUSTOM_PROPERTY_NAME_PREFIX = "cp.";
const CUSTOM_DISPLAY_PROPERTY_PREFIX = "custom_property_";
const CUSTOM_FILTER_PROPERTY_PREFIX = "customproperty_";

type TBuiltInDisplayProperty = Exclude<
  keyof IIssueDisplayProperties,
  `${typeof CUSTOM_DISPLAY_PROPERTY_PREFIX}${string}`
>;
type TCustomDisplayProperty = `${typeof CUSTOM_DISPLAY_PROPERTY_PREFIX}${string}`;
export type TDisplayPropertyKey = TBuiltInDisplayProperty | TCustomDisplayProperty;

const BUILT_IN_DISPLAY_PROPERTIES = new Set<string>(ISSUE_DISPLAY_PROPERTIES_KEYS);

const isBuiltInDisplayProperty = (name: string): name is TBuiltInDisplayProperty =>
  BUILT_IN_DISPLAY_PROPERTIES.has(name);

const isCustomDisplayProperty = (key: string): key is TCustomDisplayProperty =>
  key.startsWith(CUSTOM_DISPLAY_PROPERTY_PREFIX) && UUID_PATTERN.test(key.slice(CUSTOM_DISPLAY_PROPERTY_PREFIX.length));

const customDisplayPropertyKeys = (properties: IIssueDisplayProperties) =>
  Object.keys(properties).filter(isCustomDisplayProperty);

export type TDisplayPropertyScope = {
  builtIn: readonly (keyof IIssueDisplayProperties)[];
  custom: boolean;
};

export const formatDisplayPropertyDiff = (
  state: IIssueDisplayProperties,
  baseline: IIssueDisplayProperties,
  scope: TDisplayPropertyScope
): string | undefined => {
  const keys: TDisplayPropertyKey[] = scope.builtIn.filter((key) => isBuiltInDisplayProperty(key));
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

export const parseDisplayPropertyDiff = (
  raw: string,
  scope: TDisplayPropertyScope
): TDiffParse<Partial<Record<TDisplayPropertyKey, boolean>>> => {
  const builtIn = new Set(scope.builtIn);
  const values: Partial<Record<TDisplayPropertyKey, boolean>> = {};
  const invalid: string[] = [];
  for (const { name, on } of parseDiffList(raw)) {
    if (name.startsWith(CUSTOM_PROPERTY_NAME_PREFIX)) {
      const key = `${CUSTOM_DISPLAY_PROPERTY_PREFIX}${name.slice(CUSTOM_PROPERTY_NAME_PREFIX.length).toLowerCase()}`;
      if (scope.custom && isCustomDisplayProperty(key)) values[key] = on;
      else invalid.push(name);
    } else if (isBuiltInDisplayProperty(name) && builtIn.has(name)) {
      values[name] = on;
    } else {
      invalid.push(name);
    }
  }
  return { values, invalid };
};

export const RICH_FILTERS_NONE = "none";
export const RICH_FILTERS_JSON_PREFIX = "j.";

const SUPPORTED_OPERATORS = new Set<string>([...Object.values(CORE_OPERATORS), ...Object.values(EXTENDED_OPERATORS)]);
const FILTER_PROPERTIES = new Set<string>(WORK_ITEM_FILTER_PROPERTY_KEYS);
const MULTI_VALUE_OPERATOR_SET = new Set<string>(MULTI_VALUE_OPERATORS);
const MAX_EXPRESSION_DEPTH = 32;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFilterProperty = (property: string) =>
  FILTER_PROPERTIES.has(property) ||
  (property.startsWith(CUSTOM_FILTER_PROPERTY_PREFIX) && property.length > CUSTOM_FILTER_PROPERTY_PREFIX.length);

const splitConditionKey = (key: string): { property: string; operator: string } | undefined => {
  const separator = key.lastIndexOf("__");
  if (separator <= 0) return undefined;
  const property = key.slice(0, separator);
  const operator = key.slice(separator + 2);
  return isFilterProperty(property) && SUPPORTED_OPERATORS.has(operator) ? { property, operator } : undefined;
};

const isConditionData = (value: Record<string, unknown>): value is TWorkItemFilterConditionData => {
  const entries = Object.entries(value);
  if (entries.length !== 1) return false;
  const [key, conditionValue] = entries[0];
  return (
    splitConditionKey(key) !== undefined &&
    (typeof conditionValue === "string" || typeof conditionValue === "number" || typeof conditionValue === "boolean")
  );
};

const isExpressionData = (value: unknown, depth = 0): value is TWorkItemFilterExpressionData => {
  if (depth > MAX_EXPRESSION_DEPTH || !isPlainObject(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 1) return false;
  const inner = value[keys[0]];
  if (keys[0] === LOGICAL_OPERATOR.AND)
    return Array.isArray(inner) && inner.length > 0 && inner.every((child) => isExpressionData(child, depth + 1));
  if (keys[0] === LOGICAL_OPERATOR.NOT) return isExpressionData(inner, depth + 1);
  return isConditionData(value);
};

const isEmptyExpression = (expression: TWorkItemFilterExpression) => Object.keys(expression).length === 0;

const topLevelItems = (expression: TWorkItemFilterExpressionData): TWorkItemFilterExpressionData[] =>
  LOGICAL_OPERATOR.AND in expression ? expression[LOGICAL_OPERATOR.AND] : [expression];

const toCompactProperty = (property: string): string | undefined => {
  if (!property.startsWith(CUSTOM_FILTER_PROPERTY_PREFIX)) return property;
  const id = property.slice(CUSTOM_FILTER_PROPERTY_PREFIX.length);
  return UUID_PATTERN.test(id) ? `${CUSTOM_PROPERTY_NAME_PREFIX}${id}` : undefined;
};

const fromCompactProperty = (token: string): string | undefined => {
  if (!token.startsWith(CUSTOM_PROPERTY_NAME_PREFIX)) return FILTER_PROPERTIES.has(token) ? token : undefined;
  const id = token.slice(CUSTOM_PROPERTY_NAME_PREFIX.length);
  return UUID_PATTERN.test(id) ? `${CUSTOM_FILTER_PROPERTY_PREFIX}${id}` : undefined;
};

const isCompactValue = (value: string, operator: string) =>
  value.length > 0 && !/[;:]/.test(value) && (MULTI_VALUE_OPERATOR_SET.has(operator) || !value.includes(","));

const toCompactItem = (item: TWorkItemFilterExpressionData): string | undefined => {
  let negated = false;
  let condition: Record<string, unknown> = item;
  if (LOGICAL_OPERATOR.NOT in item) {
    negated = true;
    condition = item[LOGICAL_OPERATOR.NOT];
  }
  if (!isConditionData(condition)) return undefined;
  const [key, value] = Object.entries(condition)[0];
  const parts = splitConditionKey(key);
  if (!parts || typeof value !== "string" || !isCompactValue(value, parts.operator)) return undefined;
  const property = toCompactProperty(parts.property);
  if (!property) return undefined;
  return `${negated ? "!" : ""}${property}:${parts.operator}:${value}`;
};

const fromCompactItem = (token: string): TWorkItemFilterExpressionData | undefined => {
  const negated = token.startsWith("!");
  const [propertyToken, operator, value, ...rest] = (negated ? token.slice(1) : token).split(":");
  if (rest.length > 0 || value === undefined) return undefined;
  const property = fromCompactProperty(propertyToken);
  if (!property || !SUPPORTED_OPERATORS.has(operator) || !isCompactValue(value, operator)) return undefined;
  const condition = { [`${property}__${operator}`]: value } as TWorkItemFilterConditionData;
  return negated ? { [LOGICAL_OPERATOR.NOT]: condition } : condition;
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

/** Formats a non-empty expression in the compact grammar, or as `j.<base64url(JSON)>`. */
export const formatRichFilters = (expression: TWorkItemFilterExpression): string => {
  if (isEmptyExpression(expression)) return RICH_FILTERS_NONE;
  const items = topLevelItems(expression).map(toCompactItem);
  if (items.every((item): item is string => item !== undefined)) return items.join(";");
  return `${RICH_FILTERS_JSON_PREFIX}${toBase64Url(JSON.stringify(expression))}`;
};

export const parseRichFilters = (raw: string): TParsed<TWorkItemFilterExpression> => {
  if (raw === RICH_FILTERS_NONE) return { value: {} };
  if (raw.startsWith(RICH_FILTERS_JSON_PREFIX)) {
    const json = fromBase64Url(raw.slice(RICH_FILTERS_JSON_PREFIX.length));
    if (json === undefined) return undefined;
    try {
      const value: unknown = JSON.parse(json);
      return isExpressionData(value) ? { value } : undefined;
    } catch {
      return undefined;
    }
  }
  const items = raw.split(";").map(fromCompactItem);
  if (!items.every((item): item is TWorkItemFilterExpressionData => item !== undefined)) return undefined;
  return { value: items.length === 1 ? items[0] : { [LOGICAL_OPERATOR.AND]: items } };
};

const unwrapSingleAnd = (expression: TWorkItemFilterExpressionData): TWorkItemFilterExpressionData =>
  LOGICAL_OPERATOR.AND in expression && expression[LOGICAL_OPERATOR.AND].length === 1
    ? unwrapSingleAnd(expression[LOGICAL_OPERATOR.AND][0])
    : expression;

const toComparable = (expression: TWorkItemFilterExpression) =>
  isEmptyExpression(expression) ? null : workItemFiltersAdapter.toInternal(unwrapSingleAnd(expression));

export const richFiltersEqual = (a: TWorkItemFilterExpression, b: TWorkItemFilterExpression): boolean =>
  deepCompareFilterExpressions(toComparable(a), toComparable(b));
