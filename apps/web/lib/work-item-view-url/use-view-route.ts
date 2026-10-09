// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate, useNavigation } from "react-router";
import type { Path } from "react-router";
import type { EStartOfTheWeek, IIssueFilters } from "@plane/types";
import { resolveViewState, toViewState } from "./apply";
import { applyViewIntent } from "./intent";
import type { TViewRoute } from "./intent";
import { buildViewSearch, getViewContext } from "./route";
import type { TPqlDraft, TViewLoaderData } from "./route";
import { parseSearch } from "./serialize";
import type { TWorkItemPage } from "./types";

type TDraftState = { pqlDraft: TPqlDraft };

const getDraft = (state: unknown): TPqlDraft | undefined => {
  if (typeof state !== "object" || state === null || !("pqlDraft" in state)) return undefined;
  const draft: unknown = state.pqlDraft;
  if (typeof draft !== "object" || draft === null || !("query" in draft) || typeof draft.query !== "string") {
    return undefined;
  }
  const error = "error" in draft && typeof draft.error === "string" ? draft.error : undefined;
  return { query: draft.query, error };
};

type TOptions = {
  page: TWorkItemPage;
  entityId: string;
  /** Registers the route on the filter store, or removes it with undefined. Keep it stable. */
  setRoute: (route: TViewRoute | undefined) => void;
  /** Keep it stable. */
  getSaved: () => IIssueFilters | undefined;
  weekStart: EStartOfTheWeek;
};

/**
 * Connects a route that owns the view params to its filter store. Replaces a URL the loader found not
 * canonical, and turns UI changes into replace navigations from the latest URL; the loader shows them.
 * Returns the query draft to show.
 */
export const useWorkItemViewRoute = (data: TViewLoaderData, options: TOptions) => {
  const { page, entityId, setRoute, getSaved, weekStart } = options;
  const navigate = useNavigate();
  const location = useLocation();
  const navigation = useNavigation();
  // a change during a navigation of this page builds on the URL it is heading to
  const pending = navigation.location?.pathname === location.pathname ? navigation.location : undefined;
  const latest = useRef<Path>(location);

  useEffect(() => {
    latest.current = pending ?? location;
  }, [pending, location]);

  const replaceSearch = useCallback(
    async (search: string, state?: TDraftState) => {
      const { pathname, hash } = latest.current;
      // set before React renders the navigation, so a change right after builds on this one
      latest.current = { pathname, search, hash };
      await navigate({ pathname, search, hash }, { replace: true, preventScrollReset: true, state });
    },
    [navigate]
  );

  useEffect(() => {
    if (data.canonicalSearch === undefined) return;
    // the canonical URL has no query, so its history entry keeps the draft
    const state = data.pqlDraft && { pqlDraft: data.pqlDraft };
    replaceSearch(data.canonicalSearch, state).catch((error: unknown) => console.error(error));
  }, [data, replaceSearch]);

  useEffect(() => {
    setRoute({
      entityId,
      onIntent: async (intent) => {
        const current = new URLSearchParams(latest.current.search);
        const { baseline, clock } = getViewContext(page, weekStart);
        const saved = getSaved();
        const shown = resolveViewState(
          parseSearch(current, page),
          page,
          baseline,
          saved ? toViewState(saved) : baseline
        );
        const next = applyViewIntent(shown.state, intent, page);
        await replaceSearch(`?${buildViewSearch(next, page, baseline, clock, current)}`);
      },
    });
    return () => setRoute(undefined);
  }, [entityId, setRoute, getSaved, page, weekStart, replaceSearch]);

  const keptDraft = useMemo(() => getDraft(location.state), [location.state]);
  return { pqlDraft: data.pqlDraft ?? keptDraft };
};
