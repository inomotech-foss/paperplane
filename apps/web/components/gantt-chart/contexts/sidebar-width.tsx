/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useResizableWidth } from "@plane/hooks";
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_CHART_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from "../constants";

export type TTimelineSidebarResize = ReturnType<typeof useResizableWidth> & {
  minWidth: number;
  maxWidth: number;
};

export const TimelineSidebarContext = createContext<TTimelineSidebarResize | null>(null);

export const useTimelineSidebarWidth = () => useContext(TimelineSidebarContext)?.width ?? SIDEBAR_WIDTH;

export const useTimelineSidebarResize = () => useContext(TimelineSidebarContext);

/** Leaves at least SIDEBAR_MIN_CHART_WIDTH for the chart once the container is measured. */
export const getSidebarMaxWidth = (containerWidth: number) =>
  containerWidth > 0
    ? Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, containerWidth - SIDEBAR_MIN_CHART_WIDTH))
    : SIDEBAR_MAX_WIDTH;

export const useTimelineSidebarResizeState = () => {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  const maxWidth = getSidebarMaxWidth(containerWidth);
  const {
    width,
    isResizing,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
    onKeyDown,
    reset,
  } = useResizableWidth({
    storageKey: SIDEBAR_WIDTH_STORAGE_KEY,
    defaultWidth: SIDEBAR_WIDTH,
    minWidth: SIDEBAR_MIN_WIDTH,
    maxWidth,
  });

  const value = useMemo<TTimelineSidebarResize>(
    () => ({
      width,
      isResizing,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture,
      onKeyDown,
      reset,
      minWidth: SIDEBAR_MIN_WIDTH,
      maxWidth,
    }),
    [
      width,
      isResizing,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture,
      onKeyDown,
      reset,
      maxWidth,
    ]
  );

  return { value, containerRef: setContainer };
};
