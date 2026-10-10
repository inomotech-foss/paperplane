// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { IIssueFilters } from "@plane/types";
import { resolveViewState, toViewState, withPql } from "./state";
import { peekCodec } from "./codecs";
import { getPageBaseline } from "./pages";
import { parseSearch, toSearch } from "./serialize";
import type { TParsedSearch } from "./serialize";
import { normalizeSearch, stringifySearch } from "./stringify";
import type { TCalendarClock, TWorkItemPage, TWorkItemViewState } from "./types";

/** A query from the URL that did not validate. It stays in the URL and the query bar shows it unapplied. */
export type TPqlDraft = { query: string; error?: string };

export type TPqlCheck = { valid: boolean; error?: string };

/** What resolving a view URL needs. Injected, so the step runs without the client store. */
export type TViewDeps = {
  /** The saved preferences. */
  loadSaved: () => Promise<IIssueFilters>;
  validatePql?: (pql: string) => Promise<TPqlCheck>;
  clock: () => TCalendarClock;
  /** What a missing param means, e.g. a saved view's config. Defaults to the page baseline. */
  loadBaseline?: () => Promise<TWorkItemViewState>;
};

/** The view a URL asks for, as plain data. */
export type TViewRouteData = {
  /** What the list shows. Without the query of a draft. */
  state: TWorkItemViewState;
  draft?: TPqlDraft;
  /** Set when the URL is not canonical: the search to replace it with. */
  canonical?: string;
  clock: TCalendarClock;
  /** What a missing param means. */
  baseline: TWorkItemViewState;
  /** The saved preferences the state was resolved against, the baseline if they failed to load. */
  saved: TWorkItemViewState;
};

const getViewBaseline = (
  page: TWorkItemPage,
  clock: TCalendarClock,
  base: TWorkItemViewState = getPageBaseline(page)
): TWorkItemViewState => ({ ...base, calendarAnchor: clock.today });

/** The query the URL asks for. It applies on every layout of a page with PQL. */
const urlPql = (parsed: TParsedSearch, page: TWorkItemPage) =>
  parsed.explicit && page.pql ? (parsed.params.find(({ param }) => param === "q")?.raw.trim() ?? "") : "";

/** The search string for a view state. Keeps the peek and the params the view does not own from `current`. */
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

const loadSaved = async (deps: TViewDeps): Promise<TWorkItemViewState | undefined> => {
  try {
    return toViewState(await deps.loadSaved());
  } catch (error) {
    console.error(error);
    return undefined;
  }
};

const checkPql = async (deps: TViewDeps, pql: string): Promise<TPqlCheck> => {
  if (!pql || !deps.validatePql) return { valid: true };
  try {
    return await deps.validatePql(pql);
  } catch (error) {
    // a failed check is no reason to drop the query. The list reports a broken one.
    console.error(error);
    return { valid: true };
  }
};

/**
 * Resolves the view a URL asks for. Without view params that is the saved preferences. A query in the URL
 * that does not validate is returned as a draft and not applied. Has no side effects.
 */
export const resolveViewRoute = async (url: URL, page: TWorkItemPage, deps: TViewDeps): Promise<TViewRouteData> => {
  const parsed = parseSearch(url.searchParams, page);
  const pql = urlPql(parsed, page);
  const clock = deps.clock();
  const [saved, check, base] = await Promise.all([loadSaved(deps), checkPql(deps, pql), deps.loadBaseline?.()]);

  const baseline = getViewBaseline(page, clock, base);
  const savedState = saved ?? baseline;
  let state = resolveViewState(parsed, page, baseline, savedState);
  if (!parsed.explicit) {
    // what the canonical URL of the saved preferences shows, so one redirect reaches it
    const search = buildViewSearch(state, page, baseline, clock, url.searchParams);
    state = resolveViewState(parseSearch(new URLSearchParams(search), page), page, baseline, savedState);
  }
  const draft = check.valid ? undefined : { query: pql, error: check.error };
  const search = `?${buildViewSearch(state, page, baseline, clock, url.searchParams)}`;
  // a plain URL stays plain while the saved preferences are unknown
  const keep = (!parsed.explicit && !saved) || normalizeSearch(search) === normalizeSearch(url.search);
  return {
    state: draft ? withPql(state, baseline.displayFilters.pql) : state,
    draft,
    canonical: keep ? undefined : search,
    clock,
    baseline,
    saved: savedState,
  };
};
