/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useLocalStorage } from "./use-local-storage";

export type TResizableWidthOptions = {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  keyStep?: number;
};

export const useResizableWidth = (options: TResizableWidthOptions) => {
  const { storageKey, defaultWidth, minWidth, maxWidth, keyStep = 16 } = options;
  const clamp = useCallback((value: number) => Math.min(maxWidth, Math.max(minWidth, value)), [minWidth, maxWidth]);
  const { storedValue, setValue } = useLocalStorage<number>(storageKey, defaultWidth);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const storedWidth = typeof storedValue === "number" ? clamp(storedValue) : defaultWidth;
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

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      setDragWidth(clamp(drag.startWidth + e.clientX - drag.startX));
    },
    [clamp]
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      setValue(clamp(drag.startWidth + e.clientX - drag.startX));
      setDragWidth(null);
    },
    [clamp, setValue]
  );

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      const next =
        e.key === "ArrowLeft"
          ? width - keyStep
          : e.key === "ArrowRight"
            ? width + keyStep
            : e.key === "Home"
              ? minWidth
              : e.key === "End"
                ? maxWidth
                : null;
      if (next === null) return;
      e.preventDefault();
      setValue(clamp(next));
    },
    [width, keyStep, minWidth, maxWidth, clamp, setValue]
  );

  const reset = useCallback(() => {
    dragRef.current = null;
    setDragWidth(null);
    setValue(defaultWidth);
  }, [defaultWidth, setValue]);

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
