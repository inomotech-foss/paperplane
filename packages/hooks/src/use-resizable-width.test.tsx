/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useResizableWidth } from "./use-resizable-width";

const KEY = "width";
const DEFAULT = 260;
const MIN = 200;
const MAX = 480;

function Harness() {
  const r = useResizableWidth({ storageKey: KEY, defaultWidth: DEFAULT, minWidth: MIN, maxWidth: MAX });
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

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const store = (value: number) => localStorage.setItem(KEY, JSON.stringify(value));
const persisted = () => JSON.parse(localStorage.getItem(KEY) ?? "null");
const boxWidth = () => screen.getByTestId("box").style.width;
const isResizing = () => screen.getByTestId("box").dataset.resizing;

const drag = (from: number, to: number) => {
  const handle = screen.getByTestId("handle");
  fireEvent.pointerDown(handle, { clientX: from });
  fireEvent.pointerMove(handle, { clientX: to });
  fireEvent.pointerUp(handle, { clientX: to });
};

describe("useResizableWidth", () => {
  it("applies the stored width", () => {
    store(320);
    render(<Harness />);
    expect(boxWidth()).toBe("320px");
  });

  it("falls back to the default width", () => {
    render(<Harness />);
    expect(boxWidth()).toBe(`${DEFAULT}px`);
  });

  it("resizes by dragging and persists the result", () => {
    store(300);
    render(<Harness />);
    drag(300, 350);
    expect(boxWidth()).toBe("350px");
    expect(persisted()).toBe(350);
  });

  it("clamps to the minimum and maximum", () => {
    store(300);
    render(<Harness />);
    drag(300, -500);
    expect(persisted()).toBe(MIN);
    drag(MIN, 2000);
    expect(persisted()).toBe(MAX);
  });

  it("resets to the default on double click", () => {
    store(400);
    render(<Harness />);
    fireEvent.doubleClick(screen.getByTestId("handle"));
    expect(persisted()).toBe(DEFAULT);
    expect(boxWidth()).toBe(`${DEFAULT}px`);
  });

  it("updates the width and resizing flag during the drag", () => {
    store(300);
    render(<Harness />);
    const handle = screen.getByTestId("handle");
    fireEvent.pointerDown(handle, { clientX: 300 });
    expect(isResizing()).toBe("true");
    fireEvent.pointerMove(handle, { clientX: 340 });
    expect(boxWidth()).toBe("340px");
    expect(persisted()).toBe(300);
    fireEvent.pointerUp(handle, { clientX: 340 });
    expect(isResizing()).toBe("false");
  });

  it("ignores pointermove without pointerdown", () => {
    store(300);
    render(<Harness />);
    fireEvent.pointerMove(screen.getByTestId("handle"), { clientX: 400 });
    expect(boxWidth()).toBe("300px");
    expect(isResizing()).toBe("false");
  });

  it("ignores non-primary buttons", () => {
    store(300);
    render(<Harness />);
    fireEvent.pointerDown(screen.getByTestId("handle"), { clientX: 300, button: 2 });
    expect(isResizing()).toBe("false");
  });

  it.each(["pointerCancel", "lostPointerCapture"] as const)("commits the drag on %s", (event) => {
    store(300);
    render(<Harness />);
    const handle = screen.getByTestId("handle");
    fireEvent.pointerDown(handle, { clientX: 300 });
    fireEvent.pointerMove(handle, { clientX: 330 });
    fireEvent[event](handle, { clientX: 330 });
    expect(persisted()).toBe(330);
    expect(isResizing()).toBe("false");
  });

  it("resizes with the keyboard within the clamp", () => {
    store(300);
    render(<Harness />);
    const handle = screen.getByTestId("handle");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(persisted()).toBe(316);
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(persisted()).toBe(300);
    fireEvent.keyDown(handle, { key: "Home" });
    expect(persisted()).toBe(MIN);
    fireEvent.keyDown(handle, { key: "End" });
    expect(persisted()).toBe(MAX);
  });
});
