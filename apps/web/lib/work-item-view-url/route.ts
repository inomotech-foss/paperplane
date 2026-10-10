// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { redirect, replace } from "react-router";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import { applyViewState } from "./apply";
import type { TViewStateEffects, TViewStateStore } from "./apply";
import { getViewRoute } from "./registry";
import { resolveViewRoute } from "./resolve";
import type { TViewDeps, TViewRouteData } from "./resolve";
import { VIEW_PARAM_NAMES } from "./schema";
import { DEFERRED_PARAMS } from "./state";
import { normalizeSearch, stringifySearch } from "./stringify";
import type { TWorkItemPage } from "./types";

/** Everything a route needs to show an entity's view from the URL on the client. */
export type TViewBinding = {
  page: TWorkItemPage;
  entityId: string;
  deps: TViewDeps;
  store: TViewStateStore;
  /** What the shown list does on a change. */
  effects: TViewStateEffects;
  /** Where to send the visitor instead, e.g. when the feature is off. */
  redirect?: () => string | undefined;
};

const isShownByBrowser = (url: URL) => {
  const shown = new URL(window.location.href);
  return shown.pathname === url.pathname && normalizeSearch(shown.search) === normalizeSearch(url.search);
};

/**
 * Sends a load elsewhere without an extra history entry. A reload or back/forward already shows the URL, and
 * a link to a plain URL may lead to the view already shown, so those replace the entry. Any other link has not
 * added its entry yet, so the redirect takes the link's own action.
 */
const redirectFrom = (url: URL, target: string) =>
  isShownByBrowser(url) || isShownByBrowser(new URL(target, url)) ? replace(target) : redirect(target);

/**
 * For a clientLoader: resolves the URL, replaces a non-canonical one, and applies the view to the store
 * before the route renders. Never saves.
 */
export const loadViewRoute = async (request: Request, binding: TViewBinding): Promise<TViewRouteData> => {
  const { page, entityId } = binding;
  const url = new URL(request.url);
  const target = binding.redirect?.();
  if (target) throw redirectFrom(url, target);
  const data = await resolveViewRoute(url, page, binding.deps);
  if (data.canonical !== undefined) throw redirectFrom(url, `${url.pathname}${data.canonical}`);
  request.signal.throwIfAborted();
  const shown = getViewRoute(page, entityId) !== undefined;
  applyViewState(binding.store, entityId, data.state, shown ? binding.effects : undefined);
  return data;
};

const isAppliedParam = (key: string) => VIEW_PARAM_NAMES.has(key) && !DEFERRED_PARAMS.has(key);

const appliedSearch = (url: URL) =>
  stringifySearch(new URLSearchParams([...url.searchParams].filter(([key]) => isAppliedParam(key))));

/**
 * Reruns the loader of a route that owns the view params when the params it applies, the route params or
 * the path change, and on a navigation to the same URL. Deferred params (peek, d, z) do not rerun it.
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
  if (sameParams && currentUrl.pathname === nextUrl.pathname && appliedSearch(currentUrl) === appliedSearch(nextUrl)) {
    return false;
  }
  return defaultShouldRevalidate;
};
