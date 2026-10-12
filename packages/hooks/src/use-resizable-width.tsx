/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useLocalStorage } from "./use-local-storage";

export type TResizableWidthOptions = {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  keyStep?: number;
  /**
   * Live mode: during a drag the width goes to this custom property on the target instead of
   * React state, so a large tree does not render on every pointer move.
   */
  cssProperty?: { name: string; getTarget: () => HTMLElement | null };
  /** The width the user sees, when CSS can render it narrower than the chosen width. */
  getRenderedWidth?: () => number | undefined;
};

type TDrag = { pointerId: number; startX: number; startWidth: number; width: number; moved: boolean };

const preventNativeDrag = (e: DragEvent) => e.preventDefault();

export const useResizableWidth = (options: TResizableWidthOptions) => {
  const { storageKey, defaultWidth, minWidth, maxWidth, keyStep = 16, cssProperty, getRenderedWidth } = options;
  const cssPropertyName = cssProperty?.name;
  const getCssTarget = cssProperty?.getTarget;
  const clamp = useCallback(
    (value: number) => Math.round(Math.min(maxWidth, Math.max(minWidth, value))),
    [minWidth, maxWidth]
  );
  const { storedValue, setValue } = useLocalStorage<number>(storageKey, defaultWidth);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<TDrag | null>(null);
  const chosenWidth =
    typeof storedValue === "number" && Number.isFinite(storedValue) ? clamp(storedValue) : defaultWidth;
  const width = dragWidth ?? chosenWidth;

  const writeCssWidth = useCallback(
    (value: number) => {
      if (cssPropertyName) getCssTarget?.()?.style.setProperty(cssPropertyName, `${value}px`);
    },
    [cssPropertyName, getCssTarget]
  );

  // before the first paint, so the stored width does not jump in
  useLayoutEffect(() => writeCssWidth(chosenWidth), [chosenWidth, writeCssWidth]);

  useEffect(() => {
    if (!isResizing) return;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  useEffect(() => () => window.removeEventListener("dragstart", preventNativeDrag, true), []);

  const getCurrentWidth = useCallback(
    () => clamp(getRenderedWidth?.() ?? chosenWidth),
    [chosenWidth, clamp, getRenderedWidth]
  );

  const endDrag = useCallback(
    (commit: boolean) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      window.removeEventListener("dragstart", preventNativeDrag, true);
      setIsResizing(false);
      setDragWidth(null);
      if (commit && drag.moved) setValue(drag.width);
      else writeCssWidth(chosenWidth);
    },
    [chosenWidth, setValue, writeCssWidth]
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const activeDrag = dragRef.current;
      if (activeDrag) {
        // a live drag holds pointer capture, so one without it lost its end events
        if (e.currentTarget.hasPointerCapture?.(activeDrag.pointerId)) return;
        endDrag(false);
      }
      const startWidth = getCurrentWidth();
      dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startWidth, width: startWidth, moved: false };
      // before any render, as a native drag of whatever moves under the pointer would cancel it
      window.addEventListener("dragstart", preventNativeDrag, true);
      setIsResizing(true);
      // keeps text selection from starting, which also skips the focus a click would give
      e.preventDefault();
      e.currentTarget.focus({ preventScroll: true });
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // best effort, the drag still follows moves over the handle
      }
    },
    [endDrag, getCurrentWidth]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const next = clamp(drag.startWidth + e.clientX - drag.startX);
      if (next === drag.width) return;
      drag.width = next;
      drag.moved = true;
      if (cssPropertyName) writeCssWidth(next);
      else setDragWidth(next);
    },
    [clamp, cssPropertyName, writeCssWidth]
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (dragRef.current?.pointerId !== e.pointerId) return;
      onPointerMove(e);
      endDrag(true);
    },
    [endDrag, onPointerMove]
  );

  // a cancel carries no usable position, so the width from before the drag stays
  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (dragRef.current?.pointerId === e.pointerId) endDrag(false);
    },
    [endDrag]
  );

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      const current = getCurrentWidth();
      const next =
        e.key === "ArrowLeft"
          ? current - keyStep
          : e.key === "ArrowRight"
            ? current + keyStep
            : e.key === "Home"
              ? minWidth
              : e.key === "End"
                ? maxWidth
                : null;
      if (next === null) return;
      e.preventDefault();
      setValue(clamp(next));
    },
    [getCurrentWidth, keyStep, minWidth, maxWidth, clamp, setValue]
  );

  const reset = useCallback(() => {
    endDrag(false);
    setValue(defaultWidth);
  }, [defaultWidth, endDrag, setValue]);

  return {
    /** The live width in state mode. In live CSS mode, the chosen width, which a drag does not change. */
    width,
    isResizing,
    reset,
    /** Spread these onto the handle. */
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture: onPointerCancel,
      onKeyDown,
    },
  };
};
