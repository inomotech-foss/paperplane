// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { TViewIntent } from "./intent";
import type { TWorkItemPage } from "./types";

/** A mounted route that shows an entity's view state from the URL. Filter stores hand UI changes to it. */
export type TViewRoute = {
  /** Resolves when the page shows the change. */
  onIntent: (intent: TViewIntent) => Promise<void>;
};

const routes = new Map<string, TViewRoute>();

const keyOf = (page: TWorkItemPage, entityId: string) => `${page.storeType}/${entityId}`;

/** Returns the cleanup, which removes only this registration. */
export const registerViewRoute = (page: TWorkItemPage, entityId: string, route: TViewRoute): (() => void) => {
  const key = keyOf(page, entityId);
  routes.set(key, route);
  return () => {
    if (routes.get(key) === route) routes.delete(key);
  };
};

/** The route showing this entity's list, if any. */
export const getViewRoute = (page: TWorkItemPage, entityId: string): TViewRoute | undefined =>
  routes.get(keyOf(page, entityId));
