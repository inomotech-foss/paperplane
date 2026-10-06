/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

let stored: number | null = null;
const setValue = vi.fn((value: number) => {
  stored = value;
});

vi.mock("@/hooks/use-local-storage", () => ({
  default: () => ({ storedValue: stored, setValue }),
}));

import { DEFAULT_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, useResizableWidth } from "./use-resizable-width";

function Harness() {
  const r = useResizableWidth("key");
  return (
    <div data-testid="box" data-resizing={r.isResizing} style={{ width: `${r.width}px` }}>
      <div
        role="separator"
        aria-valuenow={r.width}
        data-testid="handle"
        onPointerDown={r.onPointerDown}
        onPointerMove={r.onPointerMove}
        onPointerUp={r.onPointerUp}
        onPointerCancel={r.onPointerCancel}
        onLostPointerCapture={r.onLostPointerCapture}
        onKeyDown={r.onKeyDown}
        tabIndex={0}
        onDoubleClick={r.reset}
      />
    </div>
  );
}

// jsdom has no PointerEvent, so clientX would be dropped
beforeAll(() => {
  window.PointerEvent ??= class extends MouseEvent {} as unknown as typeof PointerEvent;
});

const drag = (from: number, to: number) => {
  const handle = screen.getByTestId("handle");
  fireEvent.pointerDown(handle, { clientX: from });
  fireEvent.pointerMove(handle, { clientX: to });
  fireEvent.pointerUp(handle, { clientX: to });
};

const boxWidth = () => screen.getByTestId("box").style.width;
const isResizing = () => screen.getByTestId("box").dataset.resizing;

describe("useResizableWidth", () => {
  beforeEach(() => setValue.mockClear());

  it("applies the stored width", () => {
    stored = 320;
    render(<Harness />);
    expect(screen.getByTestId("box").style.width).toBe("320px");
  });

  it("falls back to the default width", () => {
    stored = null;
    render(<Harness />);
    expect(screen.getByTestId("box").style.width).toBe(`${DEFAULT_SIDEBAR_WIDTH}px`);
  });

  it("resizes by dragging and persists the result", () => {
    stored = 300;
    render(<Harness />);
    drag(300, 350);
    expect(setValue).toHaveBeenLastCalledWith(350);
  });

  it("clamps to the minimum and maximum", () => {
    stored = 300;
    const { unmount } = render(<Harness />);
    drag(300, -500);
    expect(setValue).toHaveBeenLastCalledWith(MIN_SIDEBAR_WIDTH);
    unmount();
    stored = 300;
    render(<Harness />);
    drag(300, 2000);
    expect(setValue).toHaveBeenLastCalledWith(MAX_SIDEBAR_WIDTH);
  });

  it("resets to the default on double click", () => {
    stored = 400;
    render(<Harness />);
    fireEvent.doubleClick(screen.getByTestId("handle"));
    expect(setValue).toHaveBeenLastCalledWith(DEFAULT_SIDEBAR_WIDTH);
  });

  it("updates the width and resizing flag during the drag", () => {
    stored = 300;
    render(<Harness />);
    const handle = screen.getByTestId("handle");
    fireEvent.pointerDown(handle, { clientX: 300 });
    expect(isResizing()).toBe("true");
    fireEvent.pointerMove(handle, { clientX: 340 });
    expect(boxWidth()).toBe("340px");
    expect(setValue).not.toHaveBeenCalled();
    fireEvent.pointerUp(handle, { clientX: 340 });
    expect(isResizing()).toBe("false");
  });

  it("ignores pointermove without pointerdown", () => {
    stored = 300;
    render(<Harness />);
    fireEvent.pointerMove(screen.getByTestId("handle"), { clientX: 400 });
    expect(boxWidth()).toBe("300px");
    expect(isResizing()).toBe("false");
  });

  it("ignores non-primary buttons", () => {
    stored = 300;
    render(<Harness />);
    fireEvent.pointerDown(screen.getByTestId("handle"), { clientX: 300, button: 2 });
    expect(isResizing()).toBe("false");
  });

  it.each(["pointerCancel", "lostPointerCapture"] as const)("commits the drag on %s", (event) => {
    stored = 300;
    render(<Harness />);
    const handle = screen.getByTestId("handle");
    fireEvent.pointerDown(handle, { clientX: 300 });
    fireEvent.pointerMove(handle, { clientX: 330 });
    fireEvent[event](handle, { clientX: 330 });
    expect(setValue).toHaveBeenLastCalledWith(330);
    expect(isResizing()).toBe("false");
  });

  it("resizes with the keyboard within the clamp", () => {
    stored = 300;
    render(<Harness />);
    const handle = screen.getByTestId("handle");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(setValue).toHaveBeenLastCalledWith(316);
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(setValue).toHaveBeenLastCalledWith(284);
    fireEvent.keyDown(handle, { key: "Home" });
    expect(setValue).toHaveBeenLastCalledWith(MIN_SIDEBAR_WIDTH);
    fireEvent.keyDown(handle, { key: "End" });
    expect(setValue).toHaveBeenLastCalledWith(MAX_SIDEBAR_WIDTH);
  });
});
