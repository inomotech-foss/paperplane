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
      <a href="#projects">Projects</a>
    </ResizableSidebar>
  );
  return {
    sidebar: container.querySelector<HTMLElement>("#main-sidebar"),
    handle: container.querySelector<HTMLElement>("[aria-label='Resize sidebar']"),
  };
}

const persisted = () => JSON.parse(localStorage.getItem(KEY) ?? "null");

// jsdom has no PointerEvent, so clientX and pointerId would be dropped
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

beforeAll(() => {
  if (!("PointerEvent" in window)) Object.defineProperty(window, "PointerEvent", { value: TestPointerEvent });
});

const dragLink = (sidebar: HTMLElement | null) =>
  sidebar?.querySelector("a")?.dispatchEvent(new Event("dragstart", { bubbles: true, cancelable: true }));

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

  it("takes the pointer from the links under the handle", () => {
    localStorage.setItem(KEY, "300");
    const { sidebar, handle } = renderSidebar();
    expect(fireEvent.pointerDown(handle!, { clientX: 300 })).toBe(false);
    expect(document.activeElement).toBe(handle);
    fireEvent.pointerMove(handle!, { clientX: 308 });
    expect(dragLink(sidebar)).toBe(false);
    fireEvent.pointerUp(handle!, { clientX: 308 });
    expect(persisted()).toBe(308);
    expect(dragLink(sidebar)).toBe(true);
  });

  it("keeps the width when the drag is cancelled", () => {
    localStorage.setItem(KEY, "300");
    const { sidebar, handle } = renderSidebar();
    fireEvent.pointerDown(handle!, { clientX: 300 });
    fireEvent.pointerMove(handle!, { clientX: 320 });
    fireEvent.pointerCancel(handle!, { clientX: 0 });
    expect(sidebar?.style.width).toBe("300px");
    expect(persisted()).toBe(300);
  });

  it("re-renders its width during and after a drag whose pointer capture throws", () => {
    localStorage.setItem(KEY, "336");
    // what Chrome does for a pointer id it does not know, like a synthetic one
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: () => {
        throw new DOMException("No active pointer with the given id", "NotFoundError");
      },
    });
    const { sidebar, handle } = renderSidebar();
    fireEvent.pointerDown(handle!, { clientX: 340, pointerId: 7 });
    fireEvent.pointerMove(handle!, { clientX: 300, pointerId: 7 });
    expect(sidebar?.style.width).toBe("296px");
    expect(handle?.getAttribute("aria-valuenow")).toBe("296");
    fireEvent.pointerUp(handle!, { clientX: 300, pointerId: 7 });
    expect(sidebar?.style.width).toBe("296px");
    expect(persisted()).toBe(296);
    Reflect.deleteProperty(HTMLElement.prototype, "setPointerCapture");
  });

  it("starts a new drag after one that lost its end events", () => {
    localStorage.setItem(KEY, "300");
    const { handle } = renderSidebar();
    fireEvent.pointerDown(handle!, { clientX: 300 });
    fireEvent.pointerDown(handle!, { clientX: 300 });
    fireEvent.pointerMove(handle!, { clientX: 320 });
    fireEvent.pointerUp(handle!, { clientX: 320 });
    expect(persisted()).toBe(320);
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
