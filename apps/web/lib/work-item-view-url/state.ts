// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { isEqual } from "lodash-es";
import type { IIssueDisplayFilterOptions, IIssueDisplayProperties, IIssueFilters } from "@plane/types";
import { isCustomDisplayPropertyKey, richFiltersEqual } from "./codecs";
import { getPageLayout } from "./pages";
import { getApplicablePaths } from "./schema";
import type { TViewParam } from "./schema";
import { mergeSearch, normalizeViewState } from "./serialize";
import type { TParsedSearch } from "./serialize";
import type { TStatePath, TWorkItemPage, TWorkItemViewState } from "./types";

/** Owned by later work (calendar date, timeline zoom, peek); neither applied nor read from the store yet. */
const DEFERRED_PATHS: ReadonlySet<TStatePath> = new Set(["calendarAnchor", "timelineZoom", "peek"]);

/** The params of the deferred fields. */
export const DEFERRED_PARAMS: ReadonlySet<string> = new Set<TViewParam>(["d", "z", "peek"]);

const DISPLAY_FILTERS = "displayFilters.";
const DISPLAY_PROPERTIES = "displayProperties.";

export const toViewState = (filters: IIssueFilters): TWorkItemViewState => ({
  displayFilters: filters.displayFilters ?? {},
  displayProperties: filters.displayProperties ?? {},
  richFilters: filters.richFilters,
});

export const isKeyOf = <T extends object>(key: string, ...objects: T[]): key is Extract<keyof T, string> =>
  objects.some((object) => key in object);

export const copyKey = <T extends object, K extends keyof T>(target: T, source: T, key: K) => {
  target[key] = source[key];
};

/** Copies the given paths from source into a copy of base. */
const overlayPaths = (
  base: TWorkItemViewState,
  source: TWorkItemViewState,
  paths: readonly TStatePath[]
): TWorkItemViewState => {
  const displayFilters: IIssueDisplayFilterOptions = { ...base.displayFilters };
  let displayProperties: IIssueDisplayProperties = { ...base.displayProperties };
  let { richFilters } = base;
  for (const path of paths) {
    if (DEFERRED_PATHS.has(path)) continue;
    if (path === "richFilters") richFilters = source.richFilters;
    else if (path === "displayFilters.calendar.layout") {
      displayFilters.calendar = { ...displayFilters.calendar, layout: source.displayFilters.calendar?.layout };
    } else if (path === "displayProperties.custom_property_*") {
      displayProperties = Object.fromEntries(
        Object.entries(displayProperties).filter(([key]) => !isCustomDisplayPropertyKey(key))
      );
      for (const key of Object.keys(source.displayProperties)) {
        if (isCustomDisplayPropertyKey(key)) displayProperties[key] = source.displayProperties[key];
      }
    } else if (path.startsWith(DISPLAY_FILTERS)) {
      const key = path.slice(DISPLAY_FILTERS.length);
      if (isKeyOf(key, displayFilters, source.displayFilters)) copyKey(displayFilters, source.displayFilters, key);
    } else if (path.startsWith(DISPLAY_PROPERTIES)) {
      const key = path.slice(DISPLAY_PROPERTIES.length);
      if (isKeyOf(key, displayProperties, source.displayProperties)) {
        copyKey(displayProperties, source.displayProperties, key);
      }
    }
  }
  return { ...base, displayFilters, displayProperties, richFilters };
};

/**
 * The state a URL asks for. Without view params it is the saved preferences. With them, the params
 * that apply to the resulting layout set their fields (missing ones mean the baseline); fields the
 * layout does not show keep the saved preferences.
 */
export const resolveViewState = (
  parsed: TParsedSearch,
  page: TWorkItemPage,
  baseline: TWorkItemViewState,
  saved: TWorkItemViewState
): TWorkItemViewState => {
  // normalized like a URL state, so the canonical URL of saved preferences is reached in one step
  if (!parsed.explicit) return normalizeViewState(saved, page);
  const merged = mergeSearch(parsed, baseline, page);
  const layout = getPageLayout(page, merged.state.displayFilters.layout);
  return normalizeViewState(overlayPaths(saved, merged.state, getApplicablePaths(page, layout)), page);
};

export const withPql = (state: TWorkItemViewState, pql: string | undefined): TWorkItemViewState => ({
  ...state,
  displayFilters: { ...state.displayFilters, pql },
});

export type TViewStateDiff = {
  displayFilters: IIssueDisplayFilterOptions;
  displayProperties: IIssueDisplayProperties;
  richFilters: boolean;
};

/** The display filter and property keys that differ, with their next values, and whether rich filters differ. */
export const diffViewState = (current: TWorkItemViewState, next: TWorkItemViewState): TViewStateDiff => {
  const displayFilters: IIssueDisplayFilterOptions = {};
  for (const key of new Set([...Object.keys(current.displayFilters), ...Object.keys(next.displayFilters)])) {
    if (
      isKeyOf(key, next.displayFilters, current.displayFilters) &&
      !isEqual(current.displayFilters[key], next.displayFilters[key])
    ) {
      copyKey(displayFilters, next.displayFilters, key);
    }
  }
  const displayProperties: IIssueDisplayProperties = {};
  for (const key of new Set([...Object.keys(current.displayProperties), ...Object.keys(next.displayProperties)])) {
    if (
      isKeyOf(key, next.displayProperties, current.displayProperties) &&
      Boolean(current.displayProperties[key]) !== Boolean(next.displayProperties[key])
    ) {
      copyKey(displayProperties, next.displayProperties, key);
    }
  }
  return { displayFilters, displayProperties, richFilters: !richFiltersEqual(current.richFilters, next.richFilters) };
};

export const isEmptyDiff = (diff: TViewStateDiff) =>
  !diff.richFilters &&
  Object.keys(diff.displayFilters).length === 0 &&
  Object.keys(diff.displayProperties).length === 0;
