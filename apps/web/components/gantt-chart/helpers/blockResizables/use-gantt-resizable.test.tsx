/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { IGanttBlock } from "@plane/types";
import { useGanttResizable } from "./use-gantt-resizable";

const DAY_WIDTH = 10;

const store = vi.hoisted(() => ({
  updateBlockPosition: vi.fn(),
  setIsDragging: vi.fn(),
  getUpdatedPositionAfterDrag: vi.fn(() => []),
}));

vi.mock("@/hooks/use-timeline-chart", () => ({
  useTimeLineChartStore: () => ({
    ...store,
    currentViewData: { data: { dayWidth: DAY_WIDTH } },
  }),
}));

vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));

const block: IGanttBlock = {
  data: {},
  id: "block-1",
  name: "Block",
  position: { marginLeft: 0, width: 100 },
  sort_order: 0,
  start_date: "2026-01-01",
  target_date: "2026-01-10",
};

let sidebarWidth = 0;

// jsdom has no layout, so place the chart area after a sidebar of sidebarWidth
function chartAreaRect(this: HTMLElement) {
  return DOMRect.fromRect({ x: this.hasAttribute("data-gantt-chart-area") ? sidebarWidth : 0 });
}

function Harness() {
  const resizableRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleBlockDrag } = useGanttResizable(block, resizableRef, containerRef);
  return (
    <div ref={containerRef}>
      <div data-gantt-chart-area>
        <div ref={resizableRef} />
      </div>
      <button type="button" onMouseDown={(e) => handleBlockDrag(e, "right")}>
        right handle
      </button>
    </div>
  );
}

const dragRightEdgeTo = (clientX: number) => {
  fireEvent.mouseDown(screen.getByRole("button", { name: "right handle" }), { button: 0, clientX: 0 });
  fireEvent.mouseMove(document, { clientX });
  fireEvent.mouseUp(document);
};

describe("useGanttResizable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(chartAreaRect);
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([360, 500])("maps the pointer to chart days after a %ipx sidebar", (width) => {
    sidebarWidth = width;
    render(<Harness />);
    dragRightEdgeTo(width + 200);
    expect(store.updateBlockPosition).toHaveBeenCalledWith(block.id, 0, 100);
  });
});
