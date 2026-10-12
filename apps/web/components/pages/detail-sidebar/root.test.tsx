/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PageDetailsTreeSidebar } from "./root";

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "ws", projectId: "p", pageId: "" }) }));

vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: vi.fn() }) }));

vi.mock("@/hooks/store", () => ({
  EPageStoreType: { PROJECT: "PROJECT_PAGE" },
  usePageStore: () => ({
    getVisibleRows: () => [],
    getPageById: () => undefined,
    getPageAncestorIds: () => [],
    expandPages: vi.fn(),
  }),
}));

const KEY = "page_details_tree_width";

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

beforeEach(() => localStorage.clear());

const handle = () => screen.getByRole("separator");
const dragStart = () => document.body.dispatchEvent(new Event("dragstart", { bubbles: true, cancelable: true }));

describe("PageDetailsTreeSidebar resize handle", () => {
  it("drags with the shared handle props and stores the width on release", () => {
    localStorage.setItem(KEY, "300");
    render(<PageDetailsTreeSidebar />);
    expect(fireEvent.pointerDown(handle(), { clientX: 300 })).toBe(false);
    expect(document.activeElement).toBe(handle());
    fireEvent.pointerMove(handle(), { clientX: 340 });
    expect(dragStart()).toBe(false);
    expect(handle().getAttribute("aria-valuenow")).toBe("340");
    expect(localStorage.getItem(KEY)).toBe("300");
    fireEvent.pointerUp(handle(), { clientX: 340 });
    expect(localStorage.getItem(KEY)).toBe("340");
  });

  it("keeps the width when the drag is cancelled", () => {
    localStorage.setItem(KEY, "300");
    render(<PageDetailsTreeSidebar />);
    fireEvent.pointerDown(handle(), { clientX: 300 });
    fireEvent.pointerMove(handle(), { clientX: 340 });
    fireEvent.pointerCancel(handle(), { clientX: 0 });
    expect(handle().getAttribute("aria-valuenow")).toBe("300");
    expect(localStorage.getItem(KEY)).toBe("300");
  });
});
