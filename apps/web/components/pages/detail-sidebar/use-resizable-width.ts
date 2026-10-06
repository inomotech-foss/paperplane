/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import useLocalStorage from "@/hooks/use-local-storage";

export const DEFAULT_SIDEBAR_WIDTH = 260;
export const MIN_SIDEBAR_WIDTH = 200;
export const MAX_SIDEBAR_WIDTH = 480;

const KEY_STEP = 16;

const clampWidth = (value: number) => Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value));

export const useResizableWidth = (storageKey: string) => {
  const { storedValue, setValue } = useLocalStorage<number>(storageKey, DEFAULT_SIDEBAR_WIDTH);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const storedWidth = typeof storedValue === "number" ? clampWidth(storedValue) : DEFAULT_SIDEBAR_WIDTH;
  const width = dragWidth ?? storedWidth;

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      dragRef.current = { startX: e.clientX, startWidth: width };
      setDragWidth(width);
    },
    [width]
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setDragWidth(clampWidth(drag.startWidth + e.clientX - drag.startX));
  }, []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      setValue(clampWidth(drag.startWidth + e.clientX - drag.startX));
      setDragWidth(null);
    },
    [setValue]
  );

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      const next =
        e.key === "ArrowLeft"
          ? width - KEY_STEP
          : e.key === "ArrowRight"
            ? width + KEY_STEP
            : e.key === "Home"
              ? MIN_SIDEBAR_WIDTH
              : e.key === "End"
                ? MAX_SIDEBAR_WIDTH
                : null;
      if (next === null) return;
      e.preventDefault();
      setValue(clampWidth(next));
    },
    [width, setValue]
  );

  const reset = useCallback(() => {
    dragRef.current = null;
    setDragWidth(null);
    setValue(DEFAULT_SIDEBAR_WIDTH);
  }, [setValue]);

  return {
    width,
    isResizing: dragWidth !== null,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onLostPointerCapture: onPointerUp,
    onKeyDown,
    reset,
  };
};
