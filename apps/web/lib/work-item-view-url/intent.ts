// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { IIssueDisplayFilterOptions, IIssueDisplayProperties, TWorkItemFilterExpression } from "@plane/types";
import { getApplicablePaths } from "./schema";
import { normalizeViewState } from "./serialize";
import type { TWorkItemPage, TWorkItemViewState } from "./types";

/** A view change asked for in the UI. Display filters carry only the changed keys, calendar only the changed options. */
export type TViewIntent =
  | { type: "displayFilters"; changes: IIssueDisplayFilterOptions }
  | { type: "displayProperties"; changes: IIssueDisplayProperties }
  | { type: "richFilters"; expression: TWorkItemFilterExpression };

/** Merges changed display filters, calendar options one level deep. */
export const mergeDisplayFilters = (
  current: IIssueDisplayFilterOptions,
  changes: IIssueDisplayFilterOptions
): IIssueDisplayFilterOptions => ({
  ...current,
  ...changes,
  ...(changes.calendar && { calendar: { ...current.calendar, ...changes.calendar } }),
});

export const applyViewIntent = (
  state: TWorkItemViewState,
  intent: TViewIntent,
  page: TWorkItemPage
): TWorkItemViewState => {
  switch (intent.type) {
    case "displayFilters":
      return normalizeViewState(
        { ...state, displayFilters: mergeDisplayFilters(state.displayFilters, intent.changes) },
        page
      );
    case "displayProperties":
      return { ...state, displayProperties: { ...state.displayProperties, ...intent.changes } };
    case "richFilters":
      return { ...state, richFilters: intent.expression };
  }
};

const urlPaths = new Map<TWorkItemPage, ReadonlySet<string>>();

const getUrlPaths = (page: TWorkItemPage): ReadonlySet<string> => {
  let paths = urlPaths.get(page);
  if (!paths) {
    paths = new Set<string>(page.layouts.flatMap((layout) => getApplicablePaths(page, layout)));
    urlPaths.set(page, paths);
  }
  return paths;
};

/** True if the intent only changes settings the URL never holds, such as show_weekends. */
export const isPersonalIntent = (intent: TViewIntent, page: TWorkItemPage): boolean => {
  if (intent.type !== "displayFilters") return false;
  const paths = getUrlPaths(page);
  return Object.keys(intent.changes).every((key) => {
    if (key === "calendar") return intent.changes.calendar?.layout === undefined;
    return !paths.has(`displayFilters.${key}`);
  });
};
