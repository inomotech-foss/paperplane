// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { createContext, useContext, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { action, makeObservable, observable, reaction } from "mobx";
import { NavigationType, useLocation, useNavigate, useNavigationType } from "react-router";
import type { EStartOfTheWeek, IIssueFilters } from "@plane/types";
import { applyViewState, getUnverifiedPql, resolveViewState, toViewState, withPql } from "./apply";
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
export type TPqlDraft = { id: number; query: string; error: string };

/** What the page learns from the provider; observable, so read it in observers. */
class ViewUrlStatus {
  appliedKey: string | undefined = undefined;
  pqlDraft: TPqlDraft | undefined = undefined;

  constructor() {
    makeObservable(this, { appliedKey: observable.ref, pqlDraft: observable.ref, setApplied: action });
  }

  setApplied(key: string, draft: Omit<TPqlDraft, "id"> | undefined) {
    this.appliedKey = key;
    if (draft) this.pqlDraft = { id: (this.pqlDraft?.id ?? 0) + 1, ...draft };
  }
}

const ViewUrlContext = createContext<{ status: ViewUrlStatus; key: string } | null>(null);

/** Null outside a page whose route owns the view params. Call from observers. */
export const useWorkItemViewUrl = (): { ready: boolean; pqlDraft: TPqlDraft | undefined } | null => {
  const context = useContext(ViewUrlContext);
  if (!context) return null;
  return { ready: context.status.appliedKey === context.key, pqlDraft: context.status.pqlDraft };
};

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
  const lastWrite = useRef<string>(undefined);

  const clock = useMemo<TCalendarClock>(() => ({ today, weekStart }), [today, weekStart]);
  const baseline = useMemo(() => ({ ...getPageBaseline(page), calendarAnchor: today }), [page, today]);

  const writeUrl = useEffectEvent(() => {
    const current = adapter.store.filters[adapter.entityId];
    if (!current) return;
    const search = buildViewSearch(toViewState(current), page, baseline, clock, new URLSearchParams(location.search));
    const write = `${location.key}?${search}`;
    if (`?${search}` === location.search || lastWrite.current === write) return;
    lastWrite.current = write;
    void navigate(
      { pathname: location.pathname, search, hash: location.hash },
      { replace: true, preventScrollReset: true, state: VIEW_URL_WRITE }
    );
  });

  const applyUrl = useEffectEvent(async (view: TParsedSearch, key: string, run: { cancelled: boolean }) => {
    const mounted = status.appliedKey === key;
    // our own writes already match the store
    if (mounted && navigationType === NavigationType.Replace && isViewUrlWrite(location.state)) return;
    let saved = adapter.getSaved();
    if (!saved) {
      try {
        saved = await adapter.loadSaved();
      } catch (error) {
        console.error(error);
        saved = fallbackFilters(baseline);
      }
      if (run.cancelled) return;
    }
    const savedState = toViewState(saved);
    const shown = adapter.store.filters[adapter.entityId];
    let { state } = resolveViewState(view, page, baseline, savedState);
    let draft: Omit<TPqlDraft, "id"> | undefined;
    const pql = getUnverifiedPql(state, [savedState, shown && toViewState(shown)]);
    if (pql && adapter.validatePql) {
      const error = await adapter.validatePql(pql);
      if (run.cancelled) return;
      if (error !== undefined) {
        state = withPql(state, baseline.displayFilters.pql);
        draft = { query: pql, error };
      }
    }
    applyViewState(adapter.store, adapter.entityId, state, saved.kanbanFilters, mounted ? adapter.effects : undefined);
    status.setApplied(key, draft);
    writeUrl();
  });

  const { key } = adapter;
  useEffect(() => {
    const run = { cancelled: false };
    void applyUrl(parsed, key, run);
    return () => {
      run.cancelled = true;
    };
  }, [key, parsed]);

  useEffect(() => {
    const { store, entityId } = adapter;
    return reaction(
      () => {
        const current = store.filters[entityId];
        if (status.appliedKey !== adapter.key || !current) return undefined;
        return buildViewSearch(toViewState(current), page, baseline, clock);
      },
      () => writeUrl()
    );
  }, [status, adapter, page, baseline, clock]);

  const value = useMemo(() => ({ status, key }), [status, key]);
  return <ViewUrlContext.Provider value={value}>{children}</ViewUrlContext.Provider>;
}
