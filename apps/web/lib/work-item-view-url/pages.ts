// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { ISSUE_DISPLAY_FILTERS_BY_PAGE } from "@plane/constants";
import type { ILayoutDisplayFiltersOptions } from "@plane/types";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
import { getComputedDisplayFilters, getComputedDisplayProperties } from "@plane/utils";
import type { TPageFiltersKey, TSavedViewConfig, TWorkItemPage, TWorkItemViewState } from "./types";

const ALL_LAYOUTS = Object.values(EIssueLayoutTypes);

const layoutsOf = (filtersKey: TPageFiltersKey, only?: readonly EIssueLayoutTypes[]) =>
  ALL_LAYOUTS.filter(
    (layout) => layout in ISSUE_DISPLAY_FILTERS_BY_PAGE[filtersKey].layoutOptions && (!only || only.includes(layout))
  );

const projectPage = (storeType: EIssuesStoreType): TWorkItemPage => ({
  storeType,
  filtersKey: "issues",
  layouts: layoutsOf("issues"),
  kanbanGroupBy: "state",
  pql: true,
  customProperties: true,
});

export const WORK_ITEM_PAGES = {
  [EIssuesStoreType.PROJECT]: projectPage(EIssuesStoreType.PROJECT),
  [EIssuesStoreType.CYCLE]: projectPage(EIssuesStoreType.CYCLE),
  [EIssuesStoreType.MODULE]: projectPage(EIssuesStoreType.MODULE),
  [EIssuesStoreType.PROJECT_VIEW]: projectPage(EIssuesStoreType.PROJECT_VIEW),
  [EIssuesStoreType.ARCHIVED]: {
    storeType: EIssuesStoreType.ARCHIVED,
    filtersKey: "archived_issues",
    layouts: layoutsOf("archived_issues"),
    kanbanGroupBy: "state",
    pql: false,
    customProperties: true,
    forced: { sub_issue: true },
  },
  [EIssuesStoreType.PROFILE]: {
    storeType: EIssuesStoreType.PROFILE,
    filtersKey: "profile_issues",
    layouts: layoutsOf("profile_issues"),
    kanbanGroupBy: "priority",
    pql: false,
    customProperties: false,
  },
  [EIssuesStoreType.GLOBAL]: {
    storeType: EIssuesStoreType.GLOBAL,
    filtersKey: "my_issues",
    // the list layout is configured but never rendered
    layouts: layoutsOf("my_issues", [EIssueLayoutTypes.SPREADSHEET]),
    kanbanGroupBy: "state",
    pql: true,
    customProperties: false,
    defaults: { layout: EIssueLayoutTypes.SPREADSHEET, order_by: "-created_at" },
    sortOrderFallback: "-created_at",
  },
} satisfies Partial<Record<EIssuesStoreType, TWorkItemPage>>;

export type TWorkItemPageStoreType = keyof typeof WORK_ITEM_PAGES;

export const getWorkItemPage = (storeType: TWorkItemPageStoreType): TWorkItemPage => WORK_ITEM_PAGES[storeType];

export const getLayoutOptions = (
  page: TWorkItemPage,
  layout: EIssueLayoutTypes | undefined
): ILayoutDisplayFiltersOptions | undefined =>
  layout && page.layouts.includes(layout)
    ? ISSUE_DISPLAY_FILTERS_BY_PAGE[page.filtersKey].layoutOptions[layout]
    : undefined;

/** The state a page shows without stored preferences; for saved views, the view's config. */
export const getPageBaseline = (page: TWorkItemPage, view?: TSavedViewConfig): TWorkItemViewState => {
  const displayFilters = getComputedDisplayFilters(
    page.forced ? { ...view?.display_filters, ...page.forced } : view?.display_filters,
    page.defaults
  );
  if (page.sortOrderFallback && displayFilters.order_by === "sort_order") {
    displayFilters.order_by = page.sortOrderFallback;
  }
  return {
    displayFilters,
    displayProperties: getComputedDisplayProperties(view?.display_properties),
    richFilters: view?.rich_filters ?? {},
  };
};
