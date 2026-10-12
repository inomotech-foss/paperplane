/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { getChartOffset } from "./chart-area";

const CONTAINER_LEFT = 100;
const SIDEBAR = 420;
const SCROLL_LEFT = 300;

function layoutRect(this: HTMLElement) {
  const x = this.hasAttribute("data-gantt-chart-area") ? CONTAINER_LEFT + SIDEBAR - SCROLL_LEFT : CONTAINER_LEFT;
  return DOMRect.fromRect({ x });
}

afterEach(() => vi.restoreAllMocks());

describe("getChartOffset", () => {
  it("returns where the chart area starts in the scroll content", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(layoutRect);
    const container = document.createElement("div");
    const chartArea = document.createElement("div");
    chartArea.setAttribute("data-gantt-chart-area", "");
    container.append(chartArea);
    container.scrollLeft = SCROLL_LEFT;
    expect(getChartOffset(container)).toBe(SIDEBAR);
  });

  it("returns 0 without a chart area", () => {
    expect(getChartOffset(document.createElement("div"))).toBe(0);
  });
});
