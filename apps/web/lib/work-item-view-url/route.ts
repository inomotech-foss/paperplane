// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ShouldRevalidateFunctionArgs } from "react-router";
import { peekCodec } from "./codecs";
import { VIEW_PARAM_NAMES } from "./schema";
import { parseSearch, toSearch } from "./serialize";
import type { TParsedSearch } from "./serialize";
import { stringifySearch } from "./stringify";
import type { TCalendarClock, TWorkItemPage, TWorkItemViewState } from "./types";

/** Navigation state that marks a URL written from the view state. */
export const VIEW_URL_WRITE = { workItemViewUrl: true } as const;

export const isViewUrlWrite = (state: unknown): boolean =>
  typeof state === "object" && state !== null && "workItemViewUrl" in state && state.workItemViewUrl === true;

/** For a clientLoader: the view params of a request. */
export const parseViewRequest = (request: Request, page: TWorkItemPage): TParsedSearch =>
  parseSearch(new URL(request.url).searchParams, page);

const ownedSearch = (url: URL) =>
  stringifySearch(new URLSearchParams([...url.searchParams].filter(([key]) => VIEW_PARAM_NAMES.has(key))));

/** Reruns the loader of a route that owns the view params only when those or the route params change. */
export const shouldRevalidateView = ({
  currentUrl,
  nextUrl,
  currentParams,
  nextParams,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean => {
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
