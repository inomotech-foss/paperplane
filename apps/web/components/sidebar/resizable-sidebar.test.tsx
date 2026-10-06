/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { ResizableSidebar } from "./resizable-sidebar";

const platform = vi.hoisted(() => ({ isMobile: false }));

vi.mock("@plane/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@plane/hooks")>()),
  usePlatformOS: () => platform,
}));

const KEY = "sidebarWidth";
const toggleCollapsed = vi.fn();

function renderSidebar() {
  const { container } = render(
    <ResizableSidebar
      togglePeek={vi.fn()}
      toggleCollapsed={toggleCollapsed}
      storageKey={KEY}
      minWidth={236}
      maxWidth={350}
    >
      <div />
    </ResizableSidebar>
  );
  return {
    sidebar: container.querySelector<HTMLElement>("#main-sidebar"),
    handle: container.querySelector<HTMLElement>("[aria-label='Resize sidebar']"),
  };
}

const persisted = () => JSON.parse(localStorage.getItem(KEY) ?? "null");

// jsdom has no PointerEvent, so clientX would be dropped
beforeAll(() => {
  window.PointerEvent ??= class extends MouseEvent {} as unknown as typeof PointerEvent;
});

describe("ResizableSidebar", () => {
  beforeEach(() => {
    platform.isMobile = false;
    localStorage.clear();
    toggleCollapsed.mockClear();
  });

  it("does not mark the sidebar as outside-click protected on desktop", () => {
    expect(renderSidebar().sidebar?.hasAttribute("data-prevent-outside-click")).toBe(false);
  });

  it("marks the sidebar as outside-click protected on mobile", () => {
    platform.isMobile = true;
    expect(renderSidebar().sidebar?.hasAttribute("data-prevent-outside-click")).toBe(true);
  });

  it("applies the stored width", () => {
    localStorage.setItem(KEY, "300");
    expect(renderSidebar().sidebar?.style.width).toBe("300px");
  });

  it("resizes by dragging the handle within the clamp and persists the result", () => {
    localStorage.setItem(KEY, "300");
    const { sidebar, handle } = renderSidebar();
    fireEvent.pointerDown(handle!, { clientX: 300 });
    fireEvent.pointerMove(handle!, { clientX: 330 });
    expect(sidebar?.style.width).toBe("330px");
    fireEvent.pointerUp(handle!, { clientX: 330 });
    expect(persisted()).toBe(330);
    fireEvent.pointerDown(handle!, { clientX: 330 });
    fireEvent.pointerUp(handle!, { clientX: 900 });
    expect(persisted()).toBe(350);
  });

  it("resizes with the keyboard", () => {
    localStorage.setItem(KEY, "300");
    const { handle } = renderSidebar();
    fireEvent.keyDown(handle!, { key: "ArrowLeft" });
    expect(persisted()).toBe(284);
    fireEvent.keyDown(handle!, { key: "Home" });
    expect(persisted()).toBe(236);
  });

  it("toggles collapse on double click", () => {
    const { handle } = renderSidebar();
    fireEvent.doubleClick(handle!);
    expect(toggleCollapsed).toHaveBeenCalledTimes(1);
  });
});
