/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { cn } from "@plane/utils";
import { useTimelineSidebarResize } from "../contexts/sidebar-width";

export function TimelineSidebarResizeHandle() {
  const resize = useTimelineSidebarResize();
  if (!resize) return null;

  return (
    <div
      // A focusable separator is a widget, which an hr cannot be.
      // oxlint-disable-next-line jsx_a11y/prefer-tag-over-role
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={resize.width}
      aria-valuemin={resize.minWidth}
      aria-valuemax={resize.maxWidth}
      tabIndex={0}
      aria-label="Resize timeline sidebar"
      className={cn(
        "absolute top-0 right-0 z-[20] h-full w-1 translate-x-1/2 cursor-ew-resize touch-none transition-colors duration-200",
        resize.isResizing ? "w-1.5 bg-layer-1" : "hover:bg-surface-2"
      )}
      onPointerDown={resize.onPointerDown}
      onPointerMove={resize.onPointerMove}
      onPointerUp={resize.onPointerUp}
      onPointerCancel={resize.onPointerCancel}
      onLostPointerCapture={resize.onLostPointerCapture}
      onKeyDown={resize.onKeyDown}
      onDoubleClick={resize.reset}
    />
  );
}
