// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type {
  EIssueLayoutTypes,
  EIssuesStoreType,
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  TGanttViews,
  TIssueGroupByOptions,
  TIssueOrderByOptions,
  TWorkItemFilterExpression,
} from "@plane/types";

export type TPeekRef = {
  projectIdentifier: string;
  sequenceId: number;
};

export type TWorkItemViewState = {
  displayFilters: IIssueDisplayFilterOptions;
  displayProperties: IIssueDisplayProperties;
  richFilters: TWorkItemFilterExpression;
  /** First shown day as YYYY-MM-DD; undefined is today. */
  calendarAnchor?: string;
  timelineZoom?: TGanttViews;
  peek?: TPeekRef;
};

/** Keys of ISSUE_DISPLAY_FILTERS_BY_PAGE that have a work item page. */
export type TPageFiltersKey = "issues" | "archived_issues" | "profile_issues" | "my_issues";

export type TWorkItemPage = {
  storeType: EIssuesStoreType;
  filtersKey: TPageFiltersKey;
  layouts: readonly EIssueLayoutTypes[];
  kanbanGroupBy: Exclude<TIssueGroupByOptions, null>;
  pql: boolean;
  customProperties: boolean;
  /** Display filters given to getComputedDisplayFilters as defaults. */
  defaults?: IIssueDisplayFilterOptions;
  /** Display filters the store forces on load. */
  forced?: IIssueDisplayFilterOptions;
  /** Replaces a manual order on load. */
  sortOrderFallback?: TIssueOrderByOptions;
};

/** A saved view's config, as stored on the view. */
export type TSavedViewConfig = {
  display_filters?: IIssueDisplayFilterOptions;
  display_properties?: IIssueDisplayProperties;
  rich_filters?: TWorkItemFilterExpression;
};
