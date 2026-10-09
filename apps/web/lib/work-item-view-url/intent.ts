// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { IIssueDisplayFilterOptions, IIssueDisplayProperties, TWorkItemFilterExpression } from "@plane/types";
import { normalizeViewState } from "./serialize";
import type { TWorkItemPage, TWorkItemViewState } from "./types";

/** A view change asked for in the UI. Display filters carry only the changed keys, calendar only the changed options. */
export type TViewIntent =
  | { type: "displayFilters"; changes: IIssueDisplayFilterOptions }
  | { type: "displayProperties"; changes: IIssueDisplayProperties }
  | { type: "richFilters"; expression: TWorkItemFilterExpression };

/** The route that shows an entity's view state from the URL. Its filter store hands UI changes to it. */
export type TViewRoute = {
  entityId: string;
  /** Resolves when the page shows the change. */
  onIntent: (intent: TViewIntent) => Promise<void>;
};

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
