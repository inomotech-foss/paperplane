// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { z } from "zod";
import { EIssueLayoutTypes } from "../issues/issue";
import { CORE_OPERATORS, EXTENDED_OPERATORS, LOGICAL_OPERATOR } from "../rich-filters/operators";
import { WORK_ITEM_FILTER_PROPERTY_KEYS } from "../view-props";
import { isPlainObject, parseClientObject, warnClientJson } from "./parse";

export const issueGroupBySchema = z
  .enum([
    "state",
    "priority",
    "labels",
    "created_by",
    "state_detail.group",
    "project",
    "assignees",
    "cycle",
    "module",
    "target_date",
    "team_project",
  ])
  .nullable();

export type TIssueGroupByOptions = z.infer<typeof issueGroupBySchema>;

export const issueOrderBySchema = z.enum([
  "-created_at",
  "created_at",
  "updated_at",
  "-updated_at",
  "priority",
  "-priority",
  "sort_order",
  "state__name",
  "-state__name",
  "assignees__first_name",
  "-assignees__first_name",
  "labels__name",
  "-labels__name",
  "issue_module__module__name",
  "-issue_module__module__name",
  "issue_cycle__cycle__name",
  "-issue_cycle__cycle__name",
  "target_date",
  "-target_date",
  "estimate_point__key",
  "-estimate_point__key",
  "start_date",
  "-start_date",
  "link_count",
  "-link_count",
  "attachment_count",
  "-attachment_count",
  "sub_issues_count",
  "-sub_issues_count",
]);

export type TIssueOrderByOptions = z.infer<typeof issueOrderBySchema>;

export const calendarLayoutSchema = z.enum(["month", "week"]);

export type TCalendarLayouts = z.infer<typeof calendarLayoutSchema>;

/** What the timeline bars take their colour from. */
export const timelineColorBySchema = z.enum(["state", "key"]);

export type TTimelineColorBy = z.infer<typeof timelineColorBySchema>;

export const displayFiltersSchema = z.object({
  calendar: z.object({ show_weekends: z.boolean().optional(), layout: calendarLayoutSchema.optional() }).optional(),
  group_by: issueGroupBySchema.optional(),
  sub_group_by: issueGroupBySchema.optional(),
  layout: z.enum(EIssueLayoutTypes).optional(),
  order_by: issueOrderBySchema.optional(),
  show_empty_groups: z.boolean().optional(),
  sub_issue: z.boolean().optional(),
  /** Nest loaded work items under their loaded parents (table layout). Client side only. */
  hierarchy: z.boolean().optional(),
  /** Plane Query Language expression applied on top of the filters, empty for none. */
  pql: z.string().optional(),
  /** Timeline bar colour source. */
  color_by: timelineColorBySchema.optional(),
});

export type IIssueDisplayFilterOptions = z.infer<typeof displayFiltersSchema>;

const fixedDisplayPropertiesSchema = z.object({
  assignee: z.boolean().optional(),
  start_date: z.boolean().optional(),
  due_date: z.boolean().optional(),
  labels: z.boolean().optional(),
  key: z.boolean().optional(),
  priority: z.boolean().optional(),
  state: z.boolean().optional(),
  sub_issue_count: z.boolean().optional(),
  link: z.boolean().optional(),
  attachment_count: z.boolean().optional(),
  estimate: z.boolean().optional(),
  created_on: z.boolean().optional(),
  updated_on: z.boolean().optional(),
  modules: z.boolean().optional(),
  cycle: z.boolean().optional(),
  issue_type: z.boolean().optional(),
});

/** Per-project work item custom properties, keyed by `custom_property_<property_id>`. */
export type TCustomPropertyDisplayKey = `custom_property_${string}`;

export type IIssueDisplayProperties = z.infer<typeof fixedDisplayPropertiesSchema> & {
  [key: TCustomPropertyDisplayKey]: boolean | undefined;
};

const isCustomPropertyDisplayKey = (key: string): key is TCustomPropertyDisplayKey =>
  key.startsWith("custom_property_");

export const displayPropertiesSchema: z.ZodType<IIssueDisplayProperties> = z
  .looseObject(fixedDisplayPropertiesSchema.shape)
  .transform((value) => {
    const properties: IIssueDisplayProperties = fixedDisplayPropertiesSchema.parse(value);
    for (const [key, shown] of Object.entries(value)) {
      if (isCustomPropertyDisplayKey(key) && typeof shown === "boolean") properties[key] = shown;
    }
    return properties;
  });

const filterValuesSchema = z.array(z.string()).nullable().optional();

export const issueFiltersSchema = z.object({
  assignees: filterValuesSchema,
  mentions: filterValuesSchema,
  created_by: filterValuesSchema,
  labels: filterValuesSchema,
  priority: filterValuesSchema,
  cycle: filterValuesSchema,
  module: filterValuesSchema,
  project: filterValuesSchema,
  team_project: filterValuesSchema,
  start_date: filterValuesSchema,
  state: filterValuesSchema,
  state_group: filterValuesSchema,
  subscriber: filterValuesSchema,
  target_date: filterValuesSchema,
  issue_type: filterValuesSchema,
});

export type IIssueFilterOptions = z.infer<typeof issueFiltersSchema>;

const filterPropertySchema = z.union([
  z.enum(WORK_ITEM_FILTER_PROPERTY_KEYS),
  z.templateLiteral(["customproperty_", z.string()]),
]);

const filterOperatorSchema = z.enum({ ...CORE_OPERATORS, ...EXTENDED_OPERATORS });

export const filterConditionSchema = z.partialRecord(
  z.templateLiteral([filterPropertySchema, "__", filterOperatorSchema]),
  z.union([z.string(), z.boolean(), z.number()])
);

export type TWorkItemFilterConditionData = z.infer<typeof filterConditionSchema>;

export type TWorkItemFilterAndGroup = {
  [LOGICAL_OPERATOR.AND]: TWorkItemFilterExpressionData[];
};

export type TWorkItemFilterNotGroup = {
  [LOGICAL_OPERATOR.NOT]: TWorkItemFilterExpressionData;
};

export type TWorkItemFilterGroup = TWorkItemFilterAndGroup | TWorkItemFilterNotGroup;

export type TWorkItemFilterExpressionData = TWorkItemFilterConditionData | TWorkItemFilterGroup;

/** The rich filters AST. The empty object means no filter. */
export const filterExpressionSchema: z.ZodType<TWorkItemFilterExpressionData> = z.lazy(() =>
  z.union([
    z.strictObject({ [LOGICAL_OPERATOR.AND]: z.array(filterExpressionSchema) }),
    z.strictObject({ [LOGICAL_OPERATOR.NOT]: filterExpressionSchema }),
    filterConditionSchema,
  ])
);

export type TWorkItemFilterExpression = z.infer<typeof filterExpressionSchema>;

export const parseDisplayFilters = (value: unknown): IIssueDisplayFilterOptions =>
  parseClientObject("display_filters", displayFiltersSchema.shape, value, {});

/** Keeps the custom property keys, which are outside the fixed shape. */
export const parseDisplayProperties = (value: unknown): IIssueDisplayProperties => {
  const properties: IIssueDisplayProperties = parseClientObject(
    "display_properties",
    fixedDisplayPropertiesSchema.shape,
    value,
    {}
  );
  for (const key of Object.keys(properties)) {
    if (isCustomPropertyDisplayKey(key) && typeof properties[key] !== "boolean") delete properties[key];
  }
  return properties;
};

export const parseIssueFilters = (value: unknown): IIssueFilterOptions =>
  parseClientObject("filters", issueFiltersSchema.shape, value, {});

/** Drops the conditions and groups that do not parse, and keeps the rest of the expression. */
const parseExpression = (value: unknown): TWorkItemFilterExpressionData | undefined => {
  if (!isPlainObject(value)) return undefined;
  const and = value[LOGICAL_OPERATOR.AND];
  if (and !== undefined) {
    const children = Array.isArray(and) ? and.map(parseExpression) : [];
    return { [LOGICAL_OPERATOR.AND]: children.filter((child) => child !== undefined) };
  }
  const not = value[LOGICAL_OPERATOR.NOT];
  if (not !== undefined) {
    const child = parseExpression(not);
    return child && { [LOGICAL_OPERATOR.NOT]: child };
  }
  const condition: TWorkItemFilterConditionData = {};
  for (const [key, operand] of Object.entries(value)) {
    const result = filterConditionSchema.safeParse({ [key]: operand });
    if (result.success) Object.assign(condition, result.data);
  }
  return condition;
};

export const parseRichFilters = (value: unknown): TWorkItemFilterExpression => {
  const result = filterExpressionSchema.safeParse(value);
  if (result.success) return result.data;
  const parsed = parseExpression(value) ?? {};
  if (value !== null && value !== undefined) warnClientJson("rich_filters", result.error.issues);
  return parsed;
};

/** The `rich_filters`, `display_filters` and `display_properties` of a user properties response. */
export const parseIssueFiltersResponse = (value: {
  rich_filters: unknown;
  display_filters: unknown;
  display_properties: unknown;
}) => ({
  rich_filters: parseRichFilters(value.rich_filters),
  display_filters: parseDisplayFilters(value.display_filters),
  display_properties: parseDisplayProperties(value.display_properties),
});
