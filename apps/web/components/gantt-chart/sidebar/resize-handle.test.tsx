/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Profiler } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_CHART_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_RESIZE_EVENT,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_CSS_VAR,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from "../constants";
import { TimelineSidebarResizeHandle } from "./resize-handle";

let containerWidth = 1000;

// jsdom has no layout, so mimic the CSS clamp of the sidebar width
function sidebarRect(this: HTMLElement) {
  if (this.id !== "gantt-sidebar") return DOMRect.fromRect();
  const chosen = this.parentElement?.style.getPropertyValue(SIDEBAR_WIDTH_CSS_VAR) || `${SIDEBAR_WIDTH}px`;
  const max = Math.min(SIDEBAR_MAX_WIDTH, containerWidth - SIDEBAR_MIN_CHART_WIDTH);
  return DOMRect.fromRect({ width: Math.max(SIDEBAR_MIN_WIDTH, Math.min(Number.parseFloat(chosen), max)) });
}

const onRender = vi.fn();
const onResize = vi.fn();

function renderHandle() {
  render(
    <Profiler id="handle" onRender={onRender}>
      <div id="gantt-container" data-testid="container">
        <div id="gantt-sidebar">
          <TimelineSidebarResizeHandle />
        </div>
      </div>
    </Profiler>
  );
  const container = screen.getByTestId("container");
  container.addEventListener(SIDEBAR_RESIZE_EVENT, onResize);
  onRender.mockClear();
  return container;
}

const handle = () => screen.getByRole("separator", { name: "Resize timeline sidebar" });
const widthVar = () => screen.getByTestId("container").style.getPropertyValue(SIDEBAR_WIDTH_CSS_VAR);
const valueNow = () => handle().getAttribute("aria-valuenow");
const stored = () => localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);

// jsdom has no PointerEvent, so clientX would be dropped
beforeAll(() => {
  if (!("PointerEvent" in window)) Object.defineProperty(window, "PointerEvent", { value: MouseEvent });
});

beforeEach(() => {
  localStorage.clear();
  containerWidth = 1000;
  vi.clearAllMocks();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(sidebarRect);
});

afterEach(() => vi.restoreAllMocks());

describe("TimelineSidebarResizeHandle", () => {
  it("uses the default width without a stored one", () => {
    renderHandle();
    expect(widthVar()).toBe("");
    expect(valueNow()).toBe(`${SIDEBAR_WIDTH}`);
  });

  it("applies the stored width on mount", () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, "400");
    renderHandle();
    expect(widthVar()).toBe("400px");
    expect(valueNow()).toBe("400");
  });

  it("follows a drag without rendering and commits on release", () => {
    renderHandle();
    fireEvent.pointerDown(handle(), { clientX: 0 });
    fireEvent.pointerMove(handle(), { clientX: 100 });
    expect(widthVar()).toBe(`${SIDEBAR_WIDTH + 100}px`);
    expect(valueNow()).toBe(`${SIDEBAR_WIDTH + 100}`);
    expect(stored()).toBeNull();
    expect(onResize).not.toHaveBeenCalled();
    fireEvent.pointerUp(handle(), { clientX: 120 });
    expect(widthVar()).toBe(`${SIDEBAR_WIDTH + 120}px`);
    expect(stored()).toBe(`${SIDEBAR_WIDTH + 120}`);
    expect(onResize).toHaveBeenCalledOnce();
    expect(onRender).not.toHaveBeenCalled();
  });

  it("restores the width from before the drag on pointercancel", () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, "500");
    renderHandle();
    fireEvent.pointerDown(handle(), { clientX: 800 });
    fireEvent.pointerMove(handle(), { clientX: 850 });
    expect(widthVar()).toBe("550px");
    fireEvent.pointerCancel(handle(), { clientX: 0 });
    fireEvent.lostPointerCapture(handle(), { clientX: 0 });
    expect(widthVar()).toBe("500px");
    expect(valueNow()).toBe("500");
    expect(stored()).toBe("500");
    expect(onResize).not.toHaveBeenCalled();
  });

  it("falls back to the default width when a drag from it is cancelled", () => {
    renderHandle();
    fireEvent.pointerDown(handle(), { clientX: 800 });
    fireEvent.pointerMove(handle(), { clientX: 850 });
    fireEvent.pointerCancel(handle(), { clientX: 0 });
    expect(widthVar()).toBe("");
    expect(stored()).toBeNull();
  });

  it("blocks native drags only while resizing", () => {
    const container = renderHandle();
    const dragStart = () => container.dispatchEvent(new Event("dragstart", { bubbles: true, cancelable: true }));
    expect(fireEvent.pointerDown(handle(), { clientX: 0 })).toBe(false);
    expect(dragStart()).toBe(false);
    fireEvent.pointerUp(handle(), { clientX: 0 });
    expect(dragStart()).toBe(true);
  });

  it("commits the width the CSS clamp allows", () => {
    containerWidth = 700;
    renderHandle();
    fireEvent.pointerDown(handle(), { clientX: 0 });
    fireEvent.pointerUp(handle(), { clientX: 500 });
    const max = containerWidth - SIDEBAR_MIN_CHART_WIDTH;
    expect(widthVar()).toBe(`${max}px`);
    expect(stored()).toBe(`${max}`);
  });

  it("resizes with the keyboard", () => {
    renderHandle();
    fireEvent.keyDown(handle(), { key: "ArrowRight" });
    expect(stored()).toBe(`${SIDEBAR_WIDTH + 16}`);
    fireEvent.keyDown(handle(), { key: "Home" });
    expect(stored()).toBe(`${SIDEBAR_MIN_WIDTH}`);
    fireEvent.keyDown(handle(), { key: "End" });
    expect(stored()).toBe(`${SIDEBAR_MAX_WIDTH}`);
    expect(onResize).toHaveBeenCalledTimes(3);
  });

  it("resets to the default on double click", () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, "500");
    renderHandle();
    fireEvent.doubleClick(handle());
    expect(widthVar()).toBe("");
    expect(stored()).toBeNull();
    expect(valueNow()).toBe(`${SIDEBAR_WIDTH}`);
  });
});
