// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { EIssueLayoutTypes } from "@plane/types";
import { VIEW_PARAMS, VIEW_PARAM_NAMES, getParamContext } from "./schema";
import type { TViewParam } from "./schema";
import type { TWorkItemPage, TWorkItemViewState } from "./types";

export type TInvalidParam = { param: TViewParam; value: string };

export type TFromSearchResult = {
  /** The URL carries view params; missing ones mean the baseline. */
  explicit: boolean;
  state: TWorkItemViewState;
  invalid: TInvalidParam[];
};

/** Mirrors the normalizations the filter stores apply on display filter updates. */
export const normalizeViewState = (state: TWorkItemViewState, page: TWorkItemPage): TWorkItemViewState => {
  const displayFilters = { ...state.displayFilters };
  if (page.sortOrderFallback && displayFilters.order_by === "sort_order") {
    displayFilters.order_by = page.sortOrderFallback;
  }
  if (displayFilters.group_by === null) displayFilters.sub_group_by = null;
  const isKanban = displayFilters.layout === EIssueLayoutTypes.KANBAN;
  if (isKanban && displayFilters.group_by === displayFilters.sub_group_by) displayFilters.sub_group_by = null;
  if (isKanban && displayFilters.group_by === null) displayFilters.group_by = page.kanbanGroupBy;
  return { ...state, displayFilters };
};

/** Encodes the view params that differ from the baseline; `l` is always written. */
export const toSearch = (
  state: TWorkItemViewState,
  baseline: TWorkItemViewState,
  page: TWorkItemPage,
  current?: URLSearchParams
): URLSearchParams => {
  const search = new URLSearchParams();
  const context = getParamContext(page, state);
  for (const spec of VIEW_PARAMS) {
    if (!spec.appliesTo(page, context.layout)) continue;
    const value = spec.encode(state, baseline, context);
    if (value !== undefined) search.append(spec.param, value);
  }
  current?.forEach((value, key) => {
    if (!VIEW_PARAM_NAMES.has(key)) search.append(key, value);
  });
  return search;
};

export const fromSearch = (
  params: URLSearchParams,
  baseline: TWorkItemViewState,
  page: TWorkItemPage
): TFromSearchResult => {
  const explicit = VIEW_PARAMS.some(({ param }) => param !== "peek" && params.has(param));
  const invalid: TInvalidParam[] = [];
  let state: TWorkItemViewState = { ...baseline, peek: undefined };
  for (const spec of VIEW_PARAMS) {
    if (!explicit && spec.param !== "peek") continue;
    const raw = params.get(spec.param);
    if (raw === null) continue;
    const context = getParamContext(page, state);
    const decoded = spec.appliesTo(page, context.layout) ? spec.decode(raw, state, context) : { state, ok: false };
    state = decoded.state;
    if (!decoded.ok) invalid.push({ param: spec.param, value: raw });
  }
  return { explicit, state: explicit ? normalizeViewState(state, page) : state, invalid };
};
