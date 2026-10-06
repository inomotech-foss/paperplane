/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactElement } from "react";
import { useCallback, useEffect, useState, useRef } from "react";
// helpers
import { usePlatformOS, useResizableWidth } from "@plane/hooks";
import { cn } from "@plane/utils";

interface ResizableSidebarProps {
  showPeek?: boolean;
  togglePeek: (value?: boolean) => void;
  isCollapsed?: boolean;
  storageKey: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  defaultCollapsed?: boolean;
  peekDuration?: number;
  toggleCollapsed: (value?: boolean) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
  children?: ReactElement;
  extendedSidebar?: ReactElement;
  isAnyExtendedSidebarExpanded?: boolean;
  isAnySidebarDropdownOpen?: boolean;
}

export function ResizableSidebar({
  showPeek = false,
  togglePeek,
  peekDuration = 500,
  isCollapsed = false,
  toggleCollapsed: toggleCollapsedProp,
  onCollapsedChange,
  storageKey,
  defaultWidth = 250,
  minWidth = 236,
  maxWidth = 350,
  className = "",
  children,
  extendedSidebar,
  isAnyExtendedSidebarExpanded = false,
  isAnySidebarDropdownOpen = false,
}: ResizableSidebarProps) {
  // states
  const [isHoveringTrigger, setIsHoveringTrigger] = useState(false);
  // refs
  const peekTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // hooks
  const { isMobile } = usePlatformOS();
  const resize = useResizableWidth({ storageKey, defaultWidth, minWidth, maxWidth });
  const { width, isResizing } = resize;
  // handlers
  const setShowPeek = useCallback(
    (value: boolean) => {
      togglePeek(value);
    },
    [togglePeek]
  );

  const toggleCollapsed = useCallback(() => {
    toggleCollapsedProp();
    setShowPeek(false);
    setIsHoveringTrigger(false);
    if (peekTimeoutRef.current) {
      clearTimeout(peekTimeoutRef.current);
    }
  }, [toggleCollapsedProp, setShowPeek]);

  const handlePeekEnter = useCallback(() => {
    if (isCollapsed && showPeek) {
      if (peekTimeoutRef.current) {
        clearTimeout(peekTimeoutRef.current);
      }
    }
  }, [isCollapsed, showPeek]);

  const handlePeekLeave = useCallback(() => {
    if (isCollapsed && !isAnyExtendedSidebarExpanded && !isAnySidebarDropdownOpen) {
      peekTimeoutRef.current = setTimeout(() => {
        setShowPeek(false);
      }, peekDuration);
    }
  }, [isCollapsed, peekDuration, setShowPeek, isAnyExtendedSidebarExpanded, isAnySidebarDropdownOpen]);

  // Clean up timeout on unmount
  useEffect(
    () => () => {
      if (peekTimeoutRef.current) {
        clearTimeout(peekTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!isAnySidebarDropdownOpen && isCollapsed && isHoveringTrigger) {
      handlePeekLeave();
    }
  }, [isAnySidebarDropdownOpen]);

  useEffect(() => {
    if (!isAnyExtendedSidebarExpanded && isCollapsed && isHoveringTrigger) {
      handlePeekLeave();
    }
  }, [isAnyExtendedSidebarExpanded]);

  // Reset peek when sidebar is expanded
  useEffect(() => {
    if (!isCollapsed) {
      setShowPeek(false);
      setIsHoveringTrigger(false);
      if (peekTimeoutRef.current) {
        clearTimeout(peekTimeoutRef.current);
      }
    }
  }, [isCollapsed, setShowPeek]);

  useEffect(() => {
    onCollapsedChange?.(isCollapsed);
  }, [isCollapsed, onCollapsedChange]);

  const handleProps = {
    onDoubleClick: () => toggleCollapsed(),
    onPointerDown: resize.onPointerDown,
    onPointerMove: resize.onPointerMove,
    onPointerUp: resize.onPointerUp,
    onPointerCancel: resize.onPointerCancel,
    onLostPointerCapture: resize.onLostPointerCapture,
    onKeyDown: resize.onKeyDown,
    role: "separator",
    "aria-orientation": "vertical" as const,
    "aria-valuenow": width,
    "aria-valuemin": minWidth,
    "aria-valuemax": maxWidth,
    "aria-label": "Resize sidebar",
    tabIndex: 0,
  };

  return (
    <>
      {/* Main Sidebar */}
      <div
        id="main-sidebar"
        className={cn(
          "z-20 h-full border-r border-subtle bg-surface-1",
          !isResizing && "transition-all duration-300 ease-in-out",
          isCollapsed ? "w-0 translate-x-[-100%] opacity-0" : "translate-x-0 opacity-100",
          isMobile && "absolute",
          className
        )}
        style={{
          width: `${isCollapsed ? 0 : width}px`,
          minWidth: `${isCollapsed ? 0 : width}px`,
          maxWidth: `${isCollapsed ? 0 : width}px`,
        }}
        role="complementary"
        aria-label="Main sidebar"
        data-prevent-outside-click={isMobile || undefined}
      >
        <aside
          className={cn(
            "group/sidebar relative flex h-full w-full flex-col overflow-hidden bg-surface-1 pt-3",
            isAnyExtendedSidebarExpanded && "rounded-none"
          )}
        >
          {children}

          {/* Resize Handle */}
          <div
            className={cn(
              "absolute z-[20] h-full w-1 cursor-ew-resize touch-none transition-all duration-200",
              !isResizing && "hover:bg-surface-2",
              isResizing && "w-1.5 bg-layer-1",
              "top-0 right-0"
            )}
            {...handleProps}
          />
        </aside>
      </div>
      {/* Peek View */}
      <div
        className={cn(
          "shadow-sm absolute left-0 z-20 h-full bg-surface-1",
          !isResizing && "transition-all duration-300 ease-in-out",
          isCollapsed && showPeek ? "translate-x-0 opacity-100" : "translate-x-[-100%] opacity-0",
          "pointer-events-none",
          isCollapsed && showPeek && "pointer-events-auto",
          !showPeek ? "w-0" : "w-full"
        )}
        style={{
          width: `${width}px`,
        }}
        onMouseEnter={handlePeekEnter}
        onMouseLeave={handlePeekLeave}
        role="complementary"
        aria-label="Sidebar peek view"
      >
        <aside
          className={cn(
            "group/sidebar relative z-20 flex h-full w-full flex-col overflow-hidden bg-surface-1 pt-4",
            "self-center rounded-md rounded-tl-none rounded-bl-none border-r border-subtle",
            isAnyExtendedSidebarExpanded && "rounded-none"
          )}
        >
          {children}
          {/* Resize Handle */}
          <div
            className={cn(
              "absolute z-[20] h-full w-1 cursor-ew-resize touch-none transition-all duration-200",
              !isResizing && "hover:bg-surface-2",
              isResizing && "bg-layer-1",
              "top-0 right-0"
            )}
            {...handleProps}
          />
        </aside>
      </div>

      {/* Extended Sidebar */}
      {extendedSidebar && extendedSidebar}
    </>
  );
}
