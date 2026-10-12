/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TimelineSidebarResizeHandle } from "../sidebar/resize-handle";
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_CHART_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from "../constants";
import {
  getSidebarMaxWidth,
  TimelineSidebarContext,
  useTimelineSidebarResizeState,
  useTimelineSidebarWidth,
} from "./sidebar-width";

function WidthConsumer() {
  const width = useTimelineSidebarWidth();
  return <div data-testid="consumer" style={{ left: `${width}px` }} />;
}

function Harness() {
  const { value, containerRef } = useTimelineSidebarResizeState();
  return (
    <TimelineSidebarContext.Provider value={value}>
      <div ref={containerRef}>
        <TimelineSidebarResizeHandle />
        <WidthConsumer />
      </div>
    </TimelineSidebarContext.Provider>
  );
}

const handle = () => screen.getByRole("separator", { name: "Resize timeline sidebar" });
const consumerLeft = () => screen.getByTestId("consumer").style.left;
const persisted = () => JSON.parse(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY) ?? "null");

describe("getSidebarMaxWidth", () => {
  it("uses the upper bound before the container is measured", () => {
    expect(getSidebarMaxWidth(0)).toBe(SIDEBAR_MAX_WIDTH);
  });

  it("keeps room for the chart in narrow containers", () => {
    expect(getSidebarMaxWidth(800)).toBe(800 - SIDEBAR_MIN_CHART_WIDTH);
  });

  it("never goes below the minimum or above the maximum", () => {
    expect(getSidebarMaxWidth(300)).toBe(SIDEBAR_MIN_WIDTH);
    expect(getSidebarMaxWidth(4000)).toBe(SIDEBAR_MAX_WIDTH);
  });
});

describe("timeline sidebar width", () => {
  beforeEach(() => localStorage.clear());

  it("falls back to the default width outside the provider", () => {
    render(<WidthConsumer />);
    expect(consumerLeft()).toBe(`${SIDEBAR_WIDTH}px`);
  });

  it("does not render a handle outside the provider", () => {
    render(<TimelineSidebarResizeHandle />);
    expect(screen.queryByRole("separator")).toBeNull();
  });

  it("provides the default width and exposes the bounds on the handle", () => {
    render(<Harness />);
    expect(consumerLeft()).toBe(`${SIDEBAR_WIDTH}px`);
    expect(handle().getAttribute("aria-valuenow")).toBe(`${SIDEBAR_WIDTH}`);
    expect(handle().getAttribute("aria-valuemin")).toBe(`${SIDEBAR_MIN_WIDTH}`);
    expect(handle().getAttribute("aria-valuemax")).toBe(`${SIDEBAR_MAX_WIDTH}`);
  });

  it("resizes with the keyboard, persists and updates consumers", () => {
    render(<Harness />);
    fireEvent.keyDown(handle(), { key: "ArrowRight" });
    expect(consumerLeft()).toBe(`${SIDEBAR_WIDTH + 16}px`);
    expect(persisted()).toBe(SIDEBAR_WIDTH + 16);
    fireEvent.keyDown(handle(), { key: "Home" });
    expect(consumerLeft()).toBe(`${SIDEBAR_MIN_WIDTH}px`);
  });

  it("resets to the default on double click", () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, "500");
    render(<Harness />);
    expect(consumerLeft()).toBe("500px");
    fireEvent.doubleClick(handle());
    expect(consumerLeft()).toBe(`${SIDEBAR_WIDTH}px`);
    expect(persisted()).toBe(SIDEBAR_WIDTH);
  });

  it("clamps an out of range stored width", () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, "5000");
    render(<Harness />);
    expect(consumerLeft()).toBe(`${SIDEBAR_MAX_WIDTH}px`);
  });
});
