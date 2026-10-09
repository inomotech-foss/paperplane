// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { EStartOfTheWeek, IIssueFilters } from "@plane/types";
import { applyViewState, getUnverifiedPql, resolveViewState, toViewState, withPql } from "./apply";
import type { TViewStateEffects, TViewStateStore } from "./apply";
import { peekCodec } from "./codecs";
import { getPageBaseline } from "./pages";
import { VIEW_PARAM_NAMES } from "./schema";
import { parseSearch, toSearch } from "./serialize";
import { stringifySearch } from "./stringify";
import type { TCalendarClock, TWorkItemPage, TWorkItemViewState } from "./types";

/** A query from the URL that did not validate; the query bar shows it unapplied. */
export type TPqlDraft = { query: string; error?: string };

export type TViewLoaderData = {
  /** Set when the URL is not canonical; the route replaces the URL with it. */
  canonicalSearch?: string;
  pqlDraft?: TPqlDraft;
};

export type TPqlCheck = { valid: boolean; error?: string };

/** What a route's clientLoader needs to show an entity's view state. */
export type TViewSource = {
  page: TWorkItemPage;
  entityId: string;
  store: TViewStateStore;
  loadSaved: () => Promise<IIssueFilters>;
  validatePql?: (pql: string) => Promise<TPqlCheck>;
  weekStart: EStartOfTheWeek;
  /** True while the list of this entity is on screen. */
  isShown: () => boolean;
  effects: TViewStateEffects;
};

export type TViewContext = { baseline: TWorkItemViewState; clock: TCalendarClock };

const toDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const getViewContext = (page: TWorkItemPage, weekStart: EStartOfTheWeek): TViewContext => {
  const today = toDay(new Date());
  return { baseline: { ...getPageBaseline(page), calendarAnchor: today }, clock: { today, weekStart } };
};

const ownedSearch = (url: URL) =>
  stringifySearch(new URLSearchParams([...url.searchParams].filter(([key]) => VIEW_PARAM_NAMES.has(key))));

/**
 * Reruns the loader of a route that owns the view params when those, the route params or the path
 * change, and on a navigation to the same URL, which is how a change outside the URL is shown.
 */
export const shouldRevalidateView = ({
  currentUrl,
  nextUrl,
  currentParams,
  nextParams,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean => {
  if (currentUrl.href === nextUrl.href) return defaultShouldRevalidate;
  const sameParams =
    Object.keys(currentParams).length === Object.keys(nextParams).length &&
    Object.entries(currentParams).every(([key, value]) => nextParams[key] === value);
  if (sameParams && currentUrl.pathname === nextUrl.pathname && ownedSearch(currentUrl) === ownedSearch(nextUrl)) {
    return false;
  }
  return defaultShouldRevalidate;
};

/** The search string for a view state; keeps the peek and params the view does not own from `current`. */
export const buildViewSearch = (
  state: TWorkItemViewState,
  page: TWorkItemPage,
  baseline: TWorkItemViewState,
  clock: TCalendarClock,
  current?: URLSearchParams
): string => {
  const peekParam = current?.get("peek");
  const peek = peekParam ? peekCodec.parse(peekParam)?.value : undefined;
  return stringifySearch(toSearch({ ...state, peek }, baseline, page, { clock, current }));
};

const loadSaved = async (source: TViewSource): Promise<TWorkItemViewState | undefined> => {
  try {
    return toViewState(await source.loadSaved());
  } catch (error) {
    console.error(error);
    return undefined;
  }
};

const checkPql = async (source: TViewSource, pql: string): Promise<TPqlCheck> => {
  if (!source.validatePql) return { valid: true };
  try {
    return await source.validatePql(pql);
  } catch (error) {
    // a failed check is no reason to drop the query; the list reports a broken one
    console.error(error);
    return { valid: true };
  }
};

/**
 * For a clientLoader: resolves the state the URL asks for and shows it. Without view params that is
 * the saved preferences. An invalid query is not applied but returned as a draft. Never saves.
 */
export const loadViewState = async (request: Request, source: TViewSource): Promise<TViewLoaderData> => {
  const { page, entityId, store } = source;
  const url = new URL(request.url);
  const { baseline, clock } = getViewContext(page, source.weekStart);
  const saved = (await loadSaved(source)) ?? baseline;
  let { state } = resolveViewState(parseSearch(url.searchParams, page), page, baseline, saved);

  let pqlDraft: TPqlDraft | undefined;
  const shown = store.filters[entityId];
  const pql = getUnverifiedPql(state, [saved, shown && toViewState(shown)]);
  if (pql) {
    const check = await checkPql(source, pql);
    if (!check.valid) {
      state = withPql(state, baseline.displayFilters.pql);
      pqlDraft = { query: pql, error: check.error };
    }
  }

  request.signal.throwIfAborted();
  applyViewState(store, entityId, state, source.isShown() ? source.effects : undefined);
  const search = `?${buildViewSearch(state, page, baseline, clock, url.searchParams)}`;
  return { canonicalSearch: search === url.search ? undefined : search, pqlDraft };
};
