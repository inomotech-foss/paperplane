/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useLayoutEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_RESIZE_EVENT,
  SIDEBAR_WIDTH_CSS_VAR,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from "../constants";

const KEY_STEP = 16;

const clamp = (width: number) => Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));

// A native drag starting under the moving sidebar would cancel the pointer.
const preventNativeDrag = (e: DragEvent) => e.preventDefault();

const readStoredWidth = () => {
  const width = Number.parseFloat(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY) ?? "");
  return Number.isFinite(width) ? clamp(width) : null;
};

/**
 * Resizes the sidebar through a CSS variable on #gantt-container, so dragging does not render.
 * The handle must be a direct child of the sidebar.
 */
export const useSidebarResize = () => {
  const handleRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startWidth: number; previousWidth: string } | null>(null);

  const getElements = useCallback(() => {
    const handle = handleRef.current;
    const sidebar = handle?.parentElement;
    const container = handle?.closest<HTMLElement>("#gantt-container");
    return handle && sidebar && container ? { handle, sidebar, container } : null;
  }, []);

  const getRenderedWidth = useCallback(
    () => Math.round(getElements()?.sidebar.getBoundingClientRect().width ?? 0),
    [getElements]
  );

  const syncValueNow = useCallback(() => {
    getElements()?.handle.setAttribute("aria-valuenow", `${getRenderedWidth()}`);
  }, [getElements, getRenderedWidth]);

  const apply = useCallback(
    (width: number) => {
      getElements()?.container.style.setProperty(SIDEBAR_WIDTH_CSS_VAR, `${clamp(width)}px`);
      syncValueNow();
    },
    [getElements, syncValueNow]
  );

  const commit = useCallback(() => {
    const elements = getElements();
    if (!elements) return;
    const width = getRenderedWidth();
    apply(width);
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, `${width}`);
    elements.container.dispatchEvent(new Event(SIDEBAR_RESIZE_EVENT));
  }, [apply, getElements, getRenderedWidth]);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("dragstart", preventNativeDrag, true);
    delete handleRef.current?.dataset.resizing;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  // before the first paint, so a stored width does not jump
  useLayoutEffect(() => {
    const width = readStoredWidth();
    if (width === null) syncValueNow();
    else apply(width);
    return () => {
      if (dragRef.current) endDrag();
    };
  }, [apply, endDrag, syncValueNow]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const container = getElements()?.container;
      if (e.button !== 0 || !container) return;
      // preventDefault also stops the browser from focusing the handle
      e.preventDefault();
      e.currentTarget.focus({ preventScroll: true });
      e.currentTarget.setPointerCapture?.(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startWidth: getRenderedWidth(),
        previousWidth: container.style.getPropertyValue(SIDEBAR_WIDTH_CSS_VAR),
      };
      window.addEventListener("dragstart", preventNativeDrag, true);
      e.currentTarget.dataset.resizing = "true";
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    },
    [getElements, getRenderedWidth]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (drag) apply(drag.startWidth + e.clientX - drag.startX);
    },
    [apply]
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      apply(drag.startWidth + e.clientX - drag.startX);
      endDrag();
      commit();
    },
    [apply, commit, endDrag]
  );

  // a cancel carries no usable position, so restore the width from before the drag
  const onPointerCancel = useCallback(() => {
    const drag = dragRef.current;
    const container = getElements()?.container;
    if (!drag || !container) return;
    if (drag.previousWidth) container.style.setProperty(SIDEBAR_WIDTH_CSS_VAR, drag.previousWidth);
    else container.style.removeProperty(SIDEBAR_WIDTH_CSS_VAR);
    endDrag();
    syncValueNow();
  }, [endDrag, getElements, syncValueNow]);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      const width = getRenderedWidth();
      const next =
        e.key === "ArrowLeft"
          ? width - KEY_STEP
          : e.key === "ArrowRight"
            ? width + KEY_STEP
            : e.key === "Home"
              ? SIDEBAR_MIN_WIDTH
              : e.key === "End"
                ? SIDEBAR_MAX_WIDTH
                : null;
      if (next === null) return;
      e.preventDefault();
      apply(next);
      commit();
    },
    [apply, commit, getRenderedWidth]
  );

  const reset = useCallback(() => {
    const elements = getElements();
    if (!elements) return;
    endDrag();
    elements.container.style.removeProperty(SIDEBAR_WIDTH_CSS_VAR);
    localStorage.removeItem(SIDEBAR_WIDTH_STORAGE_KEY);
    syncValueNow();
    elements.container.dispatchEvent(new Event(SIDEBAR_RESIZE_EVENT));
  }, [endDrag, getElements, syncValueNow]);

  return {
    handleRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture: onPointerCancel,
    onKeyDown,
    onDoubleClick: reset,
  };
};
