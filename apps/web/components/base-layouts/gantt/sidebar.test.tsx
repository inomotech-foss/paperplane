/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BaseGanttSidebar } from "./sidebar";

vi.mock("@/hooks/use-timeline-chart", () => ({
  useTimeLineChartStore: () => ({
    getBlockById: (id: string) => ({ id, start_date: "2026-01-01", target_date: "2026-01-02" }),
    updateActiveBlockId: vi.fn(),
    isBlockActive: () => false,
    getNumberOfDaysFromPosition: () => undefined,
  }),
}));
vi.mock("@/hooks/use-intersection-observer", () => ({ useIntersectionObserver: vi.fn() }));
vi.mock("@/components/core/render-if-visible-HOC", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/gantt-chart/sidebar/gantt-dnd-HOC", () => ({
  GanttDnDHOC: ({
    id,
    isDragEnabled,
    children,
  }: {
    id: string;
    isDragEnabled: boolean;
    children: (isDragging: boolean) => ReactNode;
  }) => (
    <div data-testid={id} data-drag={String(isDragEnabled)}>
      {children(false)}
    </div>
  ),
}));

const items = { a: { id: "a", name: "A" }, b: { id: "b", name: "B" } };

const renderSidebar = (enableReorder: boolean | ((id: string) => boolean)) =>
  render(
    <BaseGanttSidebar
      blockIds={["a", "b"]}
      items={items}
      enableReorder={enableReorder}
      blockUpdateHandler={vi.fn()}
      ganttContainerRef={{ current: null }}
      renderItem={(item) => item.id}
    />
  );

describe("BaseGanttSidebar", () => {
  it("applies a per-block reorder flag", () => {
    renderSidebar((id) => id === "a");
    expect(screen.getByTestId("a").dataset.drag).toBe("true");
    expect(screen.getByTestId("b").dataset.drag).toBe("false");
  });

  it("applies a boolean reorder flag to every block", () => {
    renderSidebar(false);
    expect(screen.getByTestId("a").dataset.drag).toBe("false");
    expect(screen.getByTestId("b").dataset.drag).toBe("false");
  });
});
