// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { runInAction } from "mobx";
import type { IIssueDisplayFilterOptions, IIssueFilters } from "@plane/types";
import { copyKey, diffViewState, isEmptyDiff, isKeyOf, toViewState } from "./state";
import type { TWorkItemViewState } from "./types";

/** The parts of a filter store that applying a view state needs. */
export type TViewStateStore = {
  filters: Record<string, IIssueFilters>;
  getShouldClearIssues: (displayFilters: IIssueDisplayFilterOptions) => boolean;
  getShouldReFetchIssues: (displayFilters: IIssueDisplayFilterOptions) => boolean;
};

/** What a shown list does when its view state changes. */
export type TViewStateEffects = {
  clear: () => void;
  refetch: () => void;
  /** Mirrors new rich filters into the filter bar without saving them. */
  setRichFilters: (richFilters: TWorkItemViewState["richFilters"]) => void;
};

const assignChanged = <T extends object>(target: T, changes: T) => {
  for (const key of Object.keys(changes)) if (isKeyOf(key, changes)) copyKey(target, changes, key);
};

/**
 * Sets a view state as the shown filters without saving it. Writes only what changed, so observers of
 * unchanged keys do not rerun. Without effects the list is not shown and fetches when it mounts.
 */
export const applyViewState = (
  store: TViewStateStore,
  entityId: string,
  next: TWorkItemViewState,
  effects?: TViewStateEffects
) => {
  const current = store.filters[entityId];
  if (!current) {
    runInAction(() => {
      store.filters[entityId] = {
        richFilters: next.richFilters ?? {},
        displayFilters: next.displayFilters,
        displayProperties: next.displayProperties,
        kanbanFilters: undefined,
      };
    });
    return;
  }
  const diff = diffViewState(toViewState(current), next);
  if (isEmptyDiff(diff)) return;
  runInAction(() => {
    if (diff.richFilters) current.richFilters = next.richFilters ?? {};
    if (Object.keys(diff.displayFilters).length > 0) {
      if (current.displayFilters) assignChanged(current.displayFilters, diff.displayFilters);
      else current.displayFilters = next.displayFilters;
    }
    if (Object.keys(diff.displayProperties).length > 0) {
      if (current.displayProperties) assignChanged(current.displayProperties, diff.displayProperties);
      else current.displayProperties = next.displayProperties;
    }
  });
  if (!effects) return;
  if (diff.richFilters) effects.setRichFilters(next.richFilters);
  // a new layout mounts and fetches on its own
  if (store.getShouldClearIssues(diff.displayFilters)) effects.clear();
  else if (diff.richFilters || store.getShouldReFetchIssues(diff.displayFilters)) effects.refetch();
};
