/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from "../constants";
import { useSidebarResize } from "./use-sidebar-resize";

export function TimelineSidebarResizeHandle() {
  const { handleRef, ...handlers } = useSidebarResize();

  return (
    <div
      ref={handleRef}
      // A focusable separator is a widget, which an hr cannot be.
      // oxlint-disable-next-line jsx_a11y/prefer-tag-over-role
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      tabIndex={0}
      aria-label="Resize timeline sidebar"
      className="absolute top-0 right-0 z-[20] h-full w-1 translate-x-1/2 cursor-ew-resize touch-none transition-colors duration-200 outline-none hover:bg-surface-2 focus-visible:w-1.5 focus-visible:bg-accent-primary data-[resizing]:w-1.5 data-[resizing]:bg-layer-1"
      {...handlers}
    />
  );
}
