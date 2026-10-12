/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Profiler } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_CHART_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_RESIZE_EVENT,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_PROPERTY,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from "../constants";
import { TimelineSidebarResizeHandle } from "./resize-handle";
import { SIDEBAR_RESIZE_SETTLE_MS } from "./use-sidebar-size-observer";

let containerWidth = 1000;
let observers: TestResizeObserver[] = [];

// jsdom has no layout, so mimic the CSS clamp of the sidebar size
function layoutRect(this: HTMLElement) {
  if (this.id === "gantt-container") return DOMRect.fromRect({ width: containerWidth });
  if (this.id !== "gantt-sidebar") return DOMRect.fromRect();
  const chosen = Number.parseFloat(
    this.parentElement?.style.getPropertyValue(SIDEBAR_WIDTH_PROPERTY) || `${SIDEBAR_WIDTH}`
  );
  const max = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, containerWidth - SIDEBAR_MIN_CHART_WIDTH));
  return DOMRect.fromRect({ width: Math.max(SIDEBAR_MIN_WIDTH, Math.min(chosen, max)) });
}

class TestResizeObserver {
  readonly targets: Element[] = [];
  constructor(private readonly callback: () => void) {
    observers.push(this);
  }
  observe(target: Element) {
    this.targets.push(target);
  }
  unobserve() {}
  disconnect() {
    observers = observers.filter((observer) => observer !== this);
  }
  /** What the browser does after a layout change. */
  notify() {
    act(() => this.callback());
  }
}

// jsdom has no PointerEvent, so clientX and pointerId would be dropped
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

const onRender = vi.fn();
const onResize = vi.fn();

function renderHandle() {
  const view = render(
    <Profiler id="handle" onRender={onRender}>
      <div id="gantt-container" data-testid="container">
        <div id="gantt-sidebar">
          <TimelineSidebarResizeHandle />
        </div>
      </div>
    </Profiler>
  );
  screen.getByTestId("container").addEventListener(SIDEBAR_RESIZE_EVENT, onResize);
  return view;
}

const handle = () => screen.getByRole("separator");
const widthProperty = () => screen.getByTestId("container").style.getPropertyValue(SIDEBAR_WIDTH_PROPERTY);
const stored = () => localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
const store = (value: string) => localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, value);
const layoutChanged = () => observers.forEach((observer) => observer.notify());

beforeAll(() => {
  if (!("PointerEvent" in window)) Object.defineProperty(window, "PointerEvent", { value: TestPointerEvent });
});

beforeEach(() => {
  localStorage.clear();
  containerWidth = 1000;
  observers = [];
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(layoutRect);
  // a vertical scrollbar, which cqw does not subtract
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => containerWidth - 16);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TimelineSidebarResizeHandle", () => {
  it("describes the sidebar it resizes", () => {
    renderHandle();
    expect(handle().getAttribute("aria-controls")).toBe("gantt-sidebar");
    expect(handle().getAttribute("aria-label")).toBeTruthy();
  });

  it("writes the stored width to #gantt-container on mount", () => {
    store("400");
    renderHandle();
    expect(widthProperty()).toBe("400px");
  });

  it.each([
    ["an invalid", "wide", `${SIDEBAR_WIDTH}px`],
    ["a too small", "10", `${SIDEBAR_MIN_WIDTH}px`],
    ["a too large", "5000", `${SIDEBAR_MAX_WIDTH}px`],
  ])("handles %s stored width", (_, value, expected) => {
    store(value);
    renderHandle();
    expect(widthProperty()).toBe(expected);
  });

  it("drags without rendering and stores the chosen width on release", () => {
    renderHandle();
    fireEvent.pointerDown(handle(), { clientX: 0 });
    onRender.mockClear();
    fireEvent.pointerMove(handle(), { clientX: 100 });
    fireEvent.pointerMove(handle(), { clientX: 120 });
    expect(onRender).not.toHaveBeenCalled();
    expect(widthProperty()).toBe(`${SIDEBAR_WIDTH + 120}px`);
    expect(stored()).toBeNull();
    fireEvent.pointerUp(handle(), { clientX: 120 });
    expect(stored()).toBe(`${SIDEBAR_WIDTH + 120}`);
  });

  it("stores the chosen width even when CSS renders it narrower", () => {
    containerWidth = 700;
    renderHandle();
    fireEvent.pointerDown(handle(), { clientX: 0 });
    fireEvent.pointerUp(handle(), { clientX: 2000 });
    expect(stored()).toBe(`${SIDEBAR_MAX_WIDTH}`);
    expect(widthProperty()).toBe(`${SIDEBAR_MAX_WIDTH}px`);
  });

  it("starts a drag from the rendered width", () => {
    store("700");
    containerWidth = 700;
    renderHandle();
    fireEvent.pointerDown(handle(), { clientX: 0 });
    fireEvent.pointerUp(handle(), { clientX: -100 });
    expect(stored()).toBe(`${containerWidth - SIDEBAR_MIN_CHART_WIDTH - 100}`);
  });

  it("keeps the width from before the drag on pointercancel", () => {
    store("500");
    renderHandle();
    fireEvent.pointerDown(handle(), { clientX: 800 });
    fireEvent.pointerMove(handle(), { clientX: 850 });
    expect(widthProperty()).toBe("550px");
    fireEvent.pointerCancel(handle(), { clientX: 0 });
    fireEvent.lostPointerCapture(handle(), { clientX: 0 });
    expect(widthProperty()).toBe("500px");
    expect(stored()).toBe("500");
  });

  it("does not store a click without movement", () => {
    renderHandle();
    fireEvent.pointerDown(handle(), { clientX: 300 });
    fireEvent.pointerUp(handle(), { clientX: 300 });
    expect(stored()).toBeNull();
  });

  it("ignores non-primary buttons", () => {
    renderHandle();
    fireEvent.pointerDown(handle(), { clientX: 0, button: 2 });
    fireEvent.pointerMove(handle(), { clientX: 100 });
    expect(widthProperty()).toBe(`${SIDEBAR_WIDTH}px`);
  });

  it("focuses on pointerdown so the arrow keys work after a click", () => {
    store("400");
    renderHandle();
    fireEvent.pointerDown(handle(), { clientX: 0 });
    fireEvent.pointerUp(handle(), { clientX: 0 });
    expect(document.activeElement).toBe(handle());
    fireEvent.keyDown(handle(), { key: "ArrowRight" });
    expect(stored()).toBe("416");
    expect(widthProperty()).toBe("416px");
  });

  it("resets to the default on double click", () => {
    store("500");
    renderHandle();
    fireEvent.doubleClick(handle());
    expect(widthProperty()).toBe(`${SIDEBAR_WIDTH}px`);
    expect(stored()).toBe(`${SIDEBAR_WIDTH}`);
  });

  it("cleans up a drag that is cut short by unmounting", () => {
    const { unmount } = renderHandle();
    fireEvent.pointerDown(handle(), { clientX: 0 });
    expect(document.body.style.cursor).toBe("ew-resize");
    unmount();
    expect(document.body.style.cursor).toBe("");
    expect(observers).toHaveLength(0);
  });
});

describe("TimelineSidebarResizeHandle size observer", () => {
  it("observes the sidebar and the container", () => {
    renderHandle();
    expect(observers[0]?.targets.map((target) => target.id)).toEqual(["gantt-sidebar", "gantt-container"]);
  });

  it("updates the aria values from the rendered width", () => {
    store("600");
    renderHandle();
    layoutChanged();
    expect(handle().getAttribute("aria-valuenow")).toBe("600");
    containerWidth = 700;
    layoutChanged();
    expect(handle().getAttribute("aria-valuenow")).toBe(`${700 - SIDEBAR_MIN_CHART_WIDTH}`);
    expect(handle().getAttribute("aria-valuemax")).toBe(`${700 - SIDEBAR_MIN_CHART_WIDTH}`);
  });

  it("never reports a value above the maximum", () => {
    store("600");
    containerWidth = 646;
    renderHandle();
    layoutChanged();
    expect(handle().getAttribute("aria-valuenow")).toBe("406");
    expect(handle().getAttribute("aria-valuemax")).toBe("406");
  });

  it("announces a settled change once, but not the mounted width", () => {
    vi.useFakeTimers();
    renderHandle();
    layoutChanged();
    vi.advanceTimersByTime(SIDEBAR_RESIZE_SETTLE_MS);
    expect(onResize).not.toHaveBeenCalled();

    fireEvent.pointerDown(handle(), { clientX: 0 });
    for (const clientX of [20, 40, 60]) {
      fireEvent.pointerMove(handle(), { clientX });
      layoutChanged();
    }
    fireEvent.pointerUp(handle(), { clientX: 60 });
    expect(onResize).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SIDEBAR_RESIZE_SETTLE_MS);
    expect(onResize).toHaveBeenCalledOnce();
  });

  it("announces a narrower container that clamps the sidebar", () => {
    vi.useFakeTimers();
    store("600");
    renderHandle();
    layoutChanged();
    containerWidth = 700;
    layoutChanged();
    vi.advanceTimersByTime(SIDEBAR_RESIZE_SETTLE_MS);
    expect(onResize).toHaveBeenCalledOnce();
  });
});
