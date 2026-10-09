// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { createContext, useContext, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { action, makeObservable, observable, reaction } from "mobx";
import { NavigationType, useLocation, useNavigate, useNavigationType } from "react-router";
import type { EStartOfTheWeek, IIssueFilters } from "@plane/types";
import { applyViewState, getUnverifiedPql, resolveViewState, toViewState, trimmedPql, withPql } from "./apply";
import type { TViewStateEffects, TViewStateStore } from "./apply";
import { getPageBaseline } from "./pages";
import { VIEW_URL_WRITE, buildViewSearch, isViewUrlWrite } from "./route";
import type { TParsedSearch } from "./serialize";
import type { TCalendarClock, TWorkItemPage, TWorkItemViewState } from "./types";

/** Connects one work item page's filter store to the URL. */
export type TViewUrlAdapter = {
  /** Changes when the page shows another entity, e.g. another project. */
  key: string;
  entityId: string;
  page: TWorkItemPage;
  store: TViewStateStore;
  /** The saved preferences if loaded. */
  getSaved: () => IIssueFilters | undefined;
  loadSaved: () => Promise<IIssueFilters>;
  effects: TViewStateEffects;
  /** Resolves to an error message if the query is invalid. */
  validatePql?: (pql: string) => Promise<string | undefined>;
};

/** A query from the URL that did not validate; the query bar shows it unapplied. */
export type TPqlDraft = { query: string; error: string };

type TApplied = {
  /** The entity key the URL was applied for. */
  key: string;
  /** Changes when the query bar has to drop what it shows, e.g. after back to another query. */
  queryBarId: number;
  pqlDraft: TPqlDraft | undefined;
};

/** What the page learns from the provider; observable, so read it in observers. */
class ViewUrlStatus {
  applied: TApplied | undefined = undefined;

  constructor() {
    makeObservable(this, { applied: observable.ref, setApplied: action });
  }

  setApplied(key: string, pqlChanged: boolean, pqlDraft?: TPqlDraft) {
    const previous = this.applied;
    const resetQueryBar = previous?.key !== key || pqlChanged || !!previous.pqlDraft || !!pqlDraft;
    const queryBarId = (previous?.queryBarId ?? 0) + (resetQueryBar ? 1 : 0);
    this.applied = { key, queryBarId, pqlDraft };
  }
}

const ViewUrlContext = createContext<{ status: ViewUrlStatus; key: string } | null>(null);

export type TWorkItemViewUrlState = {
  ready: boolean;
  /** Use as the query bar's key. */
  queryBarId: number;
  pqlDraft: TPqlDraft | undefined;
};

/** Null outside a page whose route owns the view params. Call from observers. */
export const useWorkItemViewUrl = (): TWorkItemViewUrlState | null => {
  const context = useContext(ViewUrlContext);
  if (!context) return null;
  const { applied } = context.status;
  if (applied?.key !== context.key) return { ready: false, queryBarId: 0, pqlDraft: undefined };
  return { ready: true, queryBarId: applied.queryBarId, pqlDraft: applied.pqlDraft };
};

/** Past this a load or check counts as failed, so the page never stays blank. */
const REQUEST_TIMEOUT_MS = 15_000;

const withTimeout = <T,>(promise: Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no response after ${REQUEST_TIMEOUT_MS} ms`)), REQUEST_TIMEOUT_MS);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });

const toDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const fallbackFilters = (baseline: TWorkItemViewState): IIssueFilters => ({
  richFilters: baseline.richFilters ?? {},
  displayFilters: baseline.displayFilters,
  displayProperties: baseline.displayProperties,
  kanbanFilters: undefined,
});

type TProps = {
  adapter: TViewUrlAdapter;
  /** The view params, parsed by the route's clientLoader. */
  parsed: TParsedSearch;
  weekStart: EStartOfTheWeek;
  children: ReactNode;
};

/**
 * Applies the URL to the filter store without saving it, then mirrors store changes back into the
 * URL with replace. Children read `ready` to wait for the first apply.
 */
export function WorkItemViewUrlProvider(props: TProps) {
  const { adapter, parsed, weekStart, children } = props;
  const { page } = adapter;
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const [today] = useState(() => toDay(new Date()));
  const [status] = useState(() => new ViewUrlStatus());
  /** The search of a write that has not landed yet. */
  const pendingSearch = useRef<string>(undefined);
  /** An apply of a URL that is still loading or validating. */
  const applying = useRef<{ cancelled: boolean }>(undefined);

  const clock = useMemo<TCalendarClock>(() => ({ today, weekStart }), [today, weekStart]);
  const baseline = useMemo(() => ({ ...getPageBaseline(page), calendarAnchor: today }), [page, today]);

  useEffect(() => {
    if (!isViewUrlWrite(location.state) || location.search === pendingSearch.current) pendingSearch.current = undefined;
  }, [location]);

  const writeUrl = useEffectEvent(() => {
    const current = adapter.store.filters[adapter.entityId];
    // a URL still being applied wins; its apply writes the result
    if (!current || (applying.current && !applying.current.cancelled)) return;
    const shownSearch = pendingSearch.current ?? location.search;
    const search = buildViewSearch(toViewState(current), page, baseline, clock, new URLSearchParams(shownSearch));
    if (`?${search}` === shownSearch) return;
    pendingSearch.current = `?${search}`;
    Promise.resolve(
      navigate(
        { pathname: location.pathname, search, hash: location.hash },
        { replace: true, preventScrollReset: true, state: VIEW_URL_WRITE }
      )
    ).catch((error: unknown) => console.error(error));
  });

  /** Shows the saved preferences when the URL cannot be applied. */
  const showSaved = (key: string) => {
    const saved = adapter.getSaved() ?? fallbackFilters(baseline);
    applyViewState(adapter.store, adapter.entityId, toViewState(saved), saved.kanbanFilters);
    status.setApplied(key, true);
  };

  const validate = async (pql: string): Promise<string | undefined> => {
    if (!adapter.validatePql) return undefined;
    try {
      return await withTimeout(adapter.validatePql(pql));
    } catch (error) {
      console.error(error);
      return undefined;
    }
  };

  const applyUrl = useEffectEvent(async (view: TParsedSearch, key: string, run: { cancelled: boolean }) => {
    const mounted = status.applied?.key === key;
    // our own writes already match the store
    if (mounted && navigationType === NavigationType.Replace && isViewUrlWrite(location.state)) return;
    applying.current = run;
    try {
      let saved = adapter.getSaved();
      if (!saved) {
        try {
          saved = await withTimeout(adapter.loadSaved());
        } catch (error) {
          console.error(error);
          saved = fallbackFilters(baseline);
        }
        if (run.cancelled) return;
      }
      const savedState = toViewState(saved);
      const shown = adapter.store.filters[adapter.entityId];
      let { state } = resolveViewState(view, page, baseline, savedState);
      let draft: TPqlDraft | undefined;
      const pql = getUnverifiedPql(state, [savedState, shown && toViewState(shown)]);
      if (pql) {
        const error = await validate(pql);
        if (run.cancelled) return;
        if (error !== undefined) {
          state = withPql(state, baseline.displayFilters.pql);
          draft = { query: pql, error };
        }
      }
      const pqlChanged = trimmedPql(shown && toViewState(shown)) !== trimmedPql(state);
      applyViewState(
        adapter.store,
        adapter.entityId,
        state,
        saved.kanbanFilters,
        mounted ? adapter.effects : undefined
      );
      status.setApplied(key, pqlChanged, draft);
    } catch (error) {
      console.error(error);
      if (!run.cancelled && !mounted) showSaved(key);
    } finally {
      if (applying.current === run) applying.current = undefined;
    }
    if (!run.cancelled) writeUrl();
  });

  const { key } = adapter;
  useEffect(() => {
    const run = { cancelled: false };
    applyUrl(parsed, key, run).catch((error: unknown) => console.error(error));
    return () => {
      run.cancelled = true;
    };
  }, [key, parsed]);

  useEffect(() => {
    const { store, entityId } = adapter;
    return reaction(
      () => {
        const current = store.filters[entityId];
        if (status.applied?.key !== adapter.key || !current) return undefined;
        return buildViewSearch(toViewState(current), page, baseline, clock);
      },
      () => writeUrl()
    );
  }, [status, adapter, page, baseline, clock]);

  const value = useMemo(() => ({ status, key }), [status, key]);
  return <ViewUrlContext.Provider value={value}>{children}</ViewUrlContext.Provider>;
}
