// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useNavigation } from "react-router";
import type { Path } from "react-router";
import { applyViewIntent } from "./intent";
import { registerViewRoute } from "./registry";
import { buildViewSearch } from "./resolve";
import type { TViewRouteData } from "./resolve";
import { parseSearch } from "./serialize";
import { resolveViewState } from "./state";
import { normalizeSearch } from "./stringify";
import type { TWorkItemPage } from "./types";

/**
 * Connects a route that owns the view params to the filter stores: UI changes for this entity become
 * replace navigations from the latest URL, and the loader shows them.
 */
export const useWorkItemViewRoute = (data: TViewRouteData, page: TWorkItemPage, entityId: string) => {
  const { saved, clock, baseline } = data;
  const navigate = useNavigate();
  const location = useLocation();
  const { location: target } = useNavigation();
  /** The URL a change builds on, or undefined while a navigation leaves this page. */
  const latest = useRef<Path | undefined>(location);

  useEffect(() => {
    // a change during a navigation of this page builds on the URL it is heading to
    latest.current = target && target.pathname !== location.pathname ? undefined : (target ?? location);
  }, [target, location]);

  useEffect(
    () =>
      registerViewRoute(page, entityId, {
        onIntent: async (intent) => {
          // the person is leaving: navigating here would cancel that. The store still saves the change.
          if (!latest.current) return;
          const { pathname, search, hash } = latest.current;
          const current = new URLSearchParams(search);
          const state = resolveViewState(parseSearch(current, page), page, baseline, saved);
          const next = `?${buildViewSearch(applyViewIntent(state, intent, page), page, baseline, clock, current)}`;
          if (normalizeSearch(next) === normalizeSearch(search)) return;
          // set before React renders the navigation, so a change right after builds on this one
          latest.current = { pathname, search: next, hash };
          await navigate({ pathname, search: next, hash }, { replace: true, preventScrollReset: true });
        },
      }),
    [page, entityId, saved, clock, baseline, navigate]
  );
};
