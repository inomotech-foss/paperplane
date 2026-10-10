// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useNavigation } from "react-router";
import type { Path } from "react-router";
import { resolveViewState } from "./apply";
import { applyViewIntent } from "./intent";
import { registerViewRoute } from "./registry";
import { buildViewSearch, getViewBaseline } from "./resolve";
import type { TPqlDraft, TViewRouteData } from "./resolve";
import { parseSearch } from "./serialize";
import type { TWorkItemPage } from "./types";

/**
 * Connects a route that owns the view params to the filter stores: UI changes for this entity become
 * replace navigations from the latest URL, and the loader shows them. Returns the query draft to show.
 */
export const useWorkItemViewRoute = (
  data: TViewRouteData,
  page: TWorkItemPage,
  entityId: string
): TPqlDraft | undefined => {
  const { saved, clock, draft } = data;
  const navigate = useNavigate();
  const location = useLocation();
  const navigation = useNavigation();
  // a change during a navigation of this page builds on the URL it is heading to
  const pending = navigation.location?.pathname === location.pathname ? navigation.location : undefined;
  const latest = useRef<Path>(location);

  useEffect(() => {
    latest.current = pending ?? location;
  }, [pending, location]);

  useEffect(
    () =>
      registerViewRoute(page, entityId, {
        onIntent: async (intent) => {
          const { pathname, search, hash } = latest.current;
          const current = new URLSearchParams(search);
          const baseline = getViewBaseline(page, clock);
          const { state } = resolveViewState(parseSearch(current, page), page, baseline, saved);
          const next = `?${buildViewSearch(applyViewIntent(state, intent, page), page, baseline, clock, current)}`;
          // set before React renders the navigation, so a change right after builds on this one
          latest.current = { pathname, search: next, hash };
          await navigate({ pathname, search: next, hash }, { replace: true, preventScrollReset: true });
        },
      }),
    [page, entityId, saved, clock, navigate]
  );

  return draft;
};
