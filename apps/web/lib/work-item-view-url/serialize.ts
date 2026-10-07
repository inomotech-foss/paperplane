// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { sortBy } from "lodash-es";
import { normalizeDisplayFilters } from "@plane/utils";
import { getPageLayout, isPageLayout } from "./pages";
import { VIEW_PARAMS, VIEW_PARAM_NAMES, getParamContext } from "./schema";
import type { TApplyParam, TViewParam } from "./schema";
import type { TCalendarClock, TWorkItemPage, TWorkItemViewState } from "./types";

export type TInvalidParam = { param: TViewParam; value: string };

export type TParsedParam = { param: TViewParam; raw: string; apply: TApplyParam };

export type TParsedSearch = {
  /** The URL carries view params; missing ones mean the baseline. */
  explicit: boolean;
  params: TParsedParam[];
  invalid: TInvalidParam[];
};

export type TFromSearchResult = {
  explicit: boolean;
  state: TWorkItemViewState;
  invalid: TInvalidParam[];
};

export type TToSearchOptions = {
  clock: TCalendarClock;
  /** Params not owned by the schema are kept from here, after the owned ones. */
  current?: URLSearchParams;
};

const PARAM_ORDER = new Map(VIEW_PARAMS.map(({ param }, index) => [param, index]));
const SPECS = new Map(VIEW_PARAMS.map((spec) => [spec.param, spec]));

/** Mirrors the normalizations the filter stores apply on display filter changes. */
export const normalizeViewState = (state: TWorkItemViewState, page: TWorkItemPage): TWorkItemViewState => {
  const displayFilters = normalizeDisplayFilters(state.displayFilters, page.kanbanGroupBy);
  if (page.sortOrderFallback && displayFilters.order_by === "sort_order") {
    displayFilters.order_by = page.sortOrderFallback;
  }
  return { ...state, displayFilters };
};

/** Encodes the view params that differ from the baseline; `l` is always written. */
export const toSearch = (
  state: TWorkItemViewState,
  baseline: TWorkItemViewState,
  page: TWorkItemPage,
  { clock, current }: TToSearchOptions
): URLSearchParams => {
  const { layout: stateLayout } = state.displayFilters;
  const layout = getPageLayout(page, isPageLayout(page, stateLayout) ? stateLayout : baseline.displayFilters.layout);
  const resolved = { ...state, displayFilters: { ...state.displayFilters, layout } };
  const context = { ...getParamContext(page, resolved), clock };
  const search = new URLSearchParams();
  for (const spec of VIEW_PARAMS) {
    if (spec.paths(page, layout).length === 0) continue;
    const value = spec.encode(resolved, baseline, context);
    if (value !== undefined) search.append(spec.param, value);
  }
  current?.forEach((value, key) => {
    if (!VIEW_PARAM_NAMES.has(key)) search.append(key, value);
  });
  return search;
};

/** Parses the view params without a baseline; a saved view may still be loading. */
export const parseSearch = (params: URLSearchParams, page: TWorkItemPage): TParsedSearch => {
  const explicit = VIEW_PARAMS.some(({ param }) => param !== "peek" && params.has(param));
  const parsed: TParsedParam[] = [];
  const invalid: TInvalidParam[] = [];
  for (const spec of VIEW_PARAMS) {
    if (!explicit && spec.param !== "peek") continue;
    const [raw, ...duplicates] = params.getAll(spec.param);
    if (raw === undefined) continue;
    const apply = spec.parse(raw, page);
    if (apply) parsed.push({ param: spec.param, raw, apply });
    else invalid.push({ param: spec.param, value: raw });
    for (const value of duplicates) invalid.push({ param: spec.param, value });
  }
  return { explicit, params: parsed, invalid };
};

/** Applies parsed params over the baseline, in canonical order. */
export const mergeSearch = (
  parsed: TParsedSearch,
  baseline: TWorkItemViewState,
  page: TWorkItemPage
): TFromSearchResult => {
  const invalid = [...parsed.invalid];
  let state: TWorkItemViewState = { ...baseline, peek: undefined };
  for (const { param, raw, apply } of parsed.params) {
    const context = getParamContext(page, state);
    const decoded = SPECS.get(param)?.paths(page, context.layout).length ? apply(state, context) : { state, ok: false };
    state = decoded.state;
    if (!decoded.ok) invalid.push({ param, value: raw });
  }
  return {
    explicit: parsed.explicit,
    state: parsed.explicit ? normalizeViewState(state, page) : state,
    invalid: sortBy(invalid, ({ param }) => PARAM_ORDER.get(param)),
  };
};

export const fromSearch = (
  params: URLSearchParams,
  baseline: TWorkItemViewState,
  page: TWorkItemPage
): TFromSearchResult => mergeSearch(parseSearch(params, page), baseline, page);
