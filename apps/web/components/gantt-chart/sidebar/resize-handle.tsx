/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useRef } from "react";
import { useResizableWidth } from "@plane/hooks";
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_PROPERTY,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from "../constants";
import { useSidebarSizeObserver } from "./use-sidebar-size-observer";

/** Sets the chosen width on #gantt-container. CSS clamps and lays it out, so a drag does not render. */
export function TimelineSidebarResizeHandle() {
  const { t } = useTranslation();
  const handleRef = useRef<HTMLDivElement>(null);
  const getContainer = useCallback(() => handleRef.current?.closest<HTMLElement>("#gantt-container") ?? null, []);
  const getRenderedWidth = useCallback(
    () => handleRef.current?.closest<HTMLElement>("#gantt-sidebar")?.getBoundingClientRect().width,
    []
  );
  const resize = useResizableWidth({
    storageKey: SIDEBAR_WIDTH_STORAGE_KEY,
    defaultWidth: SIDEBAR_WIDTH,
    minWidth: SIDEBAR_MIN_WIDTH,
    maxWidth: SIDEBAR_MAX_WIDTH,
    cssProperty: { name: SIDEBAR_WIDTH_PROPERTY, getTarget: getContainer },
    getRenderedWidth,
  });
  useSidebarSizeObserver(handleRef);

  return (
    <div
      ref={handleRef}
      // A focusable separator is a widget, which an hr cannot be.
      // oxlint-disable-next-line jsx_a11y/prefer-tag-over-role
      role="separator"
      aria-orientation="vertical"
      aria-controls="gantt-sidebar"
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      aria-label={t("aria_labels.resize.timeline_sidebar")}
      tabIndex={0}
      className={cn(
        "absolute top-0 right-0 z-[20] h-full w-1 translate-x-1/2 cursor-ew-resize touch-none outline-none",
        "transition-colors duration-200 hover:bg-surface-2 focus-visible:w-1.5 focus-visible:bg-accent-primary",
        // a wider transparent hit area around the 4px line
        "after:absolute after:inset-y-0 after:-right-1.5 after:-left-1.5 after:content-['']",
        resize.isResizing && "w-1.5 bg-layer-1"
      )}
      {...resize.handleProps}
      onDoubleClick={resize.reset}
    />
  );
}
