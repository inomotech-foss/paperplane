/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type {
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  IIssueFilterOptions,
  TIssueGroupByOptions,
  TIssueOrderByOptions,
  TProjectUserPreferences,
  TWorkItemFilterExpression,
} from "./client-json";
import type { TIssue } from "./issues/issue";
import type { TSupportedOperators } from "./rich-filters";

export type TIssueLayouts = "list" | "kanban" | "calendar" | "spreadsheet" | "gantt_chart";

export type TIssueGroupingFilters = "active" | "backlog";

export type TIssueExtraOptions = "show_empty_groups" | "sub_issue" | "hierarchy";

export type TIssueParams =
  | "priority"
  | "state_group"
  | "state"
  | "assignees"
  | "mentions"
  | "created_by"
  | "subscriber"
  | "labels"
  | "cycle"
  | "module"
  | "start_date"
  | "target_date"
  | "project"
  | "team_project"
  | "group_by"
  | "sub_group_by"
  | "order_by"
  | "type"
  | "sub_issue"
  | "show_empty_groups"
  | "cursor"
  | "per_page"
  | "issue_type"
  | "layout"
  | "expand"
  | "filters"
  | "pql"
  | "hierarchy";

/**
 * Keys for the work item filter properties
 */
export const WORK_ITEM_FILTER_PROPERTY_KEYS = [
  "state_group",
  "priority",
  "start_date",
  "target_date",
  "assignee_id",
  "mention_id",
  "created_by_id",
  "subscriber_id",
  "label_id",
  "state_id",
  "cycle_id",
  "module_id",
  "project_id",
  "issue_type_id",
  "created_at",
  "updated_at",
  // what the query language (PQL) can do, for the click-together filters as well
  "completed_at",
  "ancestor_id",
  "parent_id",
  "name",
] as const;
/**
 * Filter property key of a work item custom property (typed custom field),
 * `customproperty_<property_id>`.
 */
export type TWorkItemCustomPropertyFilterProperty = `customproperty_${string}`;

export type TWorkItemFilterProperty =
  | (typeof WORK_ITEM_FILTER_PROPERTY_KEYS)[number]
  | TWorkItemCustomPropertyFilterProperty;

export type TWorkItemFilterConditionKey = `${TWorkItemFilterProperty}__${TSupportedOperators}`;

export type TIssueKanbanFilters = {
  group_by: string[];
  sub_group_by: string[];
};

export interface IIssueFilters {
  richFilters: TWorkItemFilterExpression;
  displayFilters: IIssueDisplayFilterOptions | undefined;
  displayProperties: IIssueDisplayProperties | undefined;
  kanbanFilters: TIssueKanbanFilters | undefined;
}

export type TSupportedFilterForUpdate = IIssueDisplayFilterOptions | IIssueDisplayProperties | TIssueKanbanFilters;

export interface ISubWorkItemFilters extends Omit<IIssueFilters, "richFilters"> {
  filters: IIssueFilterOptions;
}

export interface IIssueFiltersResponse {
  rich_filters: TWorkItemFilterExpression;
  display_filters: IIssueDisplayFilterOptions;
  display_properties: IIssueDisplayProperties;
}

export interface IProjectUserPropertiesResponse extends IIssueFiltersResponse {
  sort_order: number;
  preferences: TProjectUserPreferences;
}

export interface IWorkspaceUserPropertiesResponse extends IIssueFiltersResponse {
  navigation_project_limit?: number;
  navigation_control_preference?: "ACCORDION" | "TABBED";
  // Note: show_limited_projects is derived from navigation_project_limit (0 = false, >0 = true)
}

export interface IWorkspaceIssueFilterOptions {
  assignees?: string[] | null;
  created_by?: string[] | null;
  labels?: string[] | null;
  priority?: string[] | null;
  state_group?: string[] | null;
  subscriber?: string[] | null;
  start_date?: string[] | null;
  target_date?: string[] | null;
  project?: string[] | null;
}

export interface IWorkspaceViewIssuesParams {
  assignees?: string | undefined;
  created_by?: string | undefined;
  labels?: string | undefined;
  priority?: string | undefined;
  start_date?: string | undefined;
  state?: string | undefined;
  state_group?: string | undefined;
  subscriber?: string | undefined;
  target_date?: string | undefined;
  project?: string | undefined;
  order_by?: string | undefined;
  sub_issue?: boolean;
}

export interface IProjectViewProps {
  rich_filters: TWorkItemFilterExpression;
  display_filters: IIssueDisplayFilterOptions | undefined;
}

export interface IssuePaginationOptions {
  canGroup: boolean;
  perPageCount: number;
  before?: string;
  after?: string;
  groupedBy?: TIssueGroupByOptions;
  subGroupedBy?: TIssueGroupByOptions;
  orderBy?: TIssueOrderByOptions;
}

export type TSpreadsheetColumn = React.FC<{
  issue: TIssue;
  onClose: () => void;
  onChange: (issue: TIssue, data: Partial<TIssue>, updates: unknown) => void;
  disabled: boolean;
}>;
