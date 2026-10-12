/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { IGanttBlock } from "@plane/types";
import { SIDEBAR_WIDTH } from "../../constants";
import type { TTimelineSidebarResize } from "../../contexts/sidebar-width";
import { TimelineSidebarContext } from "../../contexts/sidebar-width";
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

const noop = () => {};

const WIDE_SIDEBAR = 500;

const wideSidebar: TTimelineSidebarResize = {
  width: WIDE_SIDEBAR,
  isResizing: false,
  onPointerDown: noop,
  onPointerMove: noop,
  onPointerUp: noop,
  onPointerCancel: noop,
  onLostPointerCapture: noop,
  onKeyDown: noop,
  reset: noop,
  minWidth: 240,
  maxWidth: 720,
};

function Harness() {
  const resizableRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleBlockDrag } = useGanttResizable(block, resizableRef, containerRef);
  return (
    <div ref={containerRef}>
      <div ref={resizableRef} />
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
  beforeEach(() => vi.clearAllMocks());

  it("maps the pointer to chart days after the provided sidebar width", () => {
    render(
      <TimelineSidebarContext.Provider value={wideSidebar}>
        <Harness />
      </TimelineSidebarContext.Provider>
    );
    dragRightEdgeTo(WIDE_SIDEBAR + 200);
    expect(store.updateBlockPosition).toHaveBeenCalledWith(block.id, 0, 100);
  });

  it("uses the default sidebar width without a provider", () => {
    render(<Harness />);
    dragRightEdgeTo(SIDEBAR_WIDTH + 200);
    expect(store.updateBlockPosition).toHaveBeenCalledWith(block.id, 0, 100);
  });
});
