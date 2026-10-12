/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useLayoutEffect } from "react";
import type { RefObject } from "react";
import { getSidebarMaxWidth, SIDEBAR_RESIZE_EVENT } from "../constants";

/** Rows rebuild their observers on the event, so it waits until a drag or window resize settles. */
export const SIDEBAR_RESIZE_SETTLE_MS = 150;

/**
 * Follows the rendered sidebar width, whatever changed it: a drag, the keyboard or a narrower
 * container. Keeps the handle's aria values current and announces settled changes.
 */
export const useSidebarSizeObserver = (handleRef: RefObject<HTMLElement | null>) => {
  useLayoutEffect(() => {
    const handle = handleRef.current;
    const sidebar = handle?.closest<HTMLElement>("#gantt-sidebar");
    const container = handle?.closest<HTMLElement>("#gantt-container");
    if (!handle || !sidebar || !container || typeof ResizeObserver === "undefined") return;

    let lastWidth: number | undefined;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    const observer = new ResizeObserver(() => {
      const width = Math.round(sidebar.getBoundingClientRect().width);
      // Chrome resolves cqw here without subtracting the scrollbar, so measure the border box
      const maxWidth = Math.max(width, getSidebarMaxWidth(container.getBoundingClientRect().width));
      handle.setAttribute("aria-valuenow", `${width}`);
      handle.setAttribute("aria-valuemax", `${maxWidth}`);
      const previousWidth = lastWidth;
      lastWidth = width;
      // the first observation is the mounted width, which rows already measured
      if (previousWidth === undefined || previousWidth === width) return;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(
        () => container.dispatchEvent(new Event(SIDEBAR_RESIZE_EVENT)),
        SIDEBAR_RESIZE_SETTLE_MS
      );
    });
    observer.observe(sidebar);
    observer.observe(container);

    return () => {
      observer.disconnect();
      clearTimeout(settleTimer);
    };
  }, [handleRef]);
};
