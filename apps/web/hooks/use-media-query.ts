// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useCallback, useSyncExternalStore } from "react";

const lists = new Map<string, MediaQueryList>();

const getList = (query: string): MediaQueryList | undefined => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
  let list = lists.get(query);
  if (!list) {
    list = window.matchMedia(query);
    lists.set(query, list);
  }
  return list;
};

/** Whether a CSS media query matches. Lets a component render one variant instead of hiding the other with CSS. */
export const useMediaQuery = (query: string, fallback = false): boolean => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = getList(query);
      list?.addEventListener("change", onChange);
      return () => list?.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => getList(query)?.matches ?? fallback,
    () => fallback
  );
};

/** Tailwind's `md` breakpoint. */
export const MD_UP = "(min-width: 768px)";
