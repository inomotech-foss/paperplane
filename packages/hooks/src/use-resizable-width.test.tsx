/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Profiler, useCallback, useRef } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useResizableWidth } from "./use-resizable-width";

const KEY = "width";
const DEFAULT = 260;
const MIN = 200;
const MAX = 480;
const PROPERTY = "--test-width";

function Harness({ live = false, renderedWidth }: { live?: boolean; renderedWidth?: number }) {
  const targetRef = useRef<HTMLDivElement>(null);
  const getTarget = useCallback(() => targetRef.current, []);
  const getRenderedWidth = useCallback(() => renderedWidth, [renderedWidth]);
  const r = useResizableWidth({
    storageKey: KEY,
    defaultWidth: DEFAULT,
    minWidth: MIN,
    maxWidth: MAX,
    getRenderedWidth,
    ...(live ? { cssProperty: { name: PROPERTY, getTarget } } : {}),
  });
  return (
    <div ref={targetRef} data-testid="box" data-resizing={r.isResizing} style={{ width: `${r.width}px` }}>
      <div
        role="separator"
        aria-valuenow={r.width}
        aria-label="Resize"
        data-testid="handle"
        {...r.handleProps}
        tabIndex={0}
        onDoubleClick={r.reset}
      />
    </div>
  );
}

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
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const store = (value: unknown) => localStorage.setItem(KEY, JSON.stringify(value));
const persisted = () => JSON.parse(localStorage.getItem(KEY) ?? "null");
const handle = () => screen.getByTestId("handle");
const boxWidth = () => screen.getByTestId("box").style.width;
const cssWidth = () => screen.getByTestId("box").style.getPropertyValue(PROPERTY);
const isResizing = () => screen.getByTestId("box").dataset.resizing;

const dragStart = () => document.body.dispatchEvent(new Event("dragstart", { bubbles: true, cancelable: true }));

const drag = (from: number, to: number) => {
  fireEvent.pointerDown(handle(), { clientX: from });
  fireEvent.pointerMove(handle(), { clientX: to });
  fireEvent.pointerUp(handle(), { clientX: to });
};

describe("useResizableWidth", () => {
  it("applies the stored width", () => {
    store(320);
    render(<Harness />);
    expect(boxWidth()).toBe("320px");
  });

  it.each([["text"], [null], [{}]])("falls back to the default width for an invalid stored value %j", (value) => {
    store(value);
    render(<Harness />);
    expect(boxWidth()).toBe(`${DEFAULT}px`);
  });

  it("clamps an out of range stored width", () => {
    store(5000);
    render(<Harness />);
    expect(boxWidth()).toBe(`${MAX}px`);
  });

  it("resizes by dragging and persists the result on release only", () => {
    store(300);
    render(<Harness />);
    fireEvent.pointerDown(handle(), { clientX: 300 });
    expect(isResizing()).toBe("true");
    fireEvent.pointerMove(handle(), { clientX: 340 });
    expect(boxWidth()).toBe("340px");
    expect(persisted()).toBe(300);
    fireEvent.pointerUp(handle(), { clientX: 340 });
    expect(persisted()).toBe(340);
    expect(isResizing()).toBe("false");
  });

  it("clamps to the minimum and maximum", () => {
    store(300);
    render(<Harness />);
    drag(300, -500);
    expect(persisted()).toBe(MIN);
    drag(MIN, 2000);
    expect(persisted()).toBe(MAX);
  });

  it("does not commit a click without movement", () => {
    render(<Harness />);
    drag(300, 300);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it.each(["pointerCancel", "lostPointerCapture"] as const)(
    "restores the width from before the drag on %s",
    (event) => {
      store(300);
      render(<Harness />);
      fireEvent.pointerDown(handle(), { clientX: 300 });
      fireEvent.pointerMove(handle(), { clientX: 360 });
      fireEvent[event](handle(), { clientX: 0 });
      expect(boxWidth()).toBe("300px");
      expect(persisted()).toBe(300);
      expect(isResizing()).toBe("false");
    }
  );

  it("ignores events from another pointer", () => {
    store(300);
    render(<Harness />);
    fireEvent.pointerDown(handle(), { clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(handle(), { clientX: 400, pointerId: 2 });
    fireEvent.pointerUp(handle(), { clientX: 400, pointerId: 2 });
    expect(boxWidth()).toBe("300px");
    expect(isResizing()).toBe("true");
  });

  it("still drags when pointer capture throws", () => {
    store(300);
    // what Chrome does for a pointer id it does not know, like a synthetic one
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: () => {
        throw new DOMException("No active pointer with the given id", "NotFoundError");
      },
    });
    render(<Harness />);
    fireEvent.pointerDown(handle(), { clientX: 300, pointerId: 7 });
    fireEvent.pointerMove(handle(), { clientX: 260, pointerId: 7 });
    expect(boxWidth()).toBe("260px");
    fireEvent.pointerUp(handle(), { clientX: 260, pointerId: 7 });
    expect(persisted()).toBe(260);
    Reflect.deleteProperty(HTMLElement.prototype, "setPointerCapture");
  });

  it("rounds fractional pointer positions to whole pixels", () => {
    store(300);
    render(<Harness />);
    drag(300, 358.953125);
    expect(persisted()).toBe(359);
    expect(handle().getAttribute("aria-valuenow")).toBe("359");
  });

  it("recovers from a drag that lost its end events", () => {
    store(300);
    render(<Harness />);
    fireEvent.pointerDown(handle(), { clientX: 300 });
    drag(300, 340);
    expect(persisted()).toBe(340);
    expect(isResizing()).toBe("false");
  });

  it("ignores pointermove without pointerdown", () => {
    store(300);
    render(<Harness />);
    fireEvent.pointerMove(handle(), { clientX: 400 });
    expect(boxWidth()).toBe("300px");
  });

  it("ignores non-primary buttons", () => {
    render(<Harness />);
    fireEvent.pointerDown(handle(), { clientX: 300, button: 2 });
    expect(isResizing()).toBe("false");
    expect(document.activeElement).not.toBe(handle());
  });

  it("focuses the handle and prevents text selection on pointerdown", () => {
    render(<Harness />);
    expect(fireEvent.pointerDown(handle(), { clientX: 300 })).toBe(false);
    expect(document.activeElement).toBe(handle());
  });

  it("blocks native drags and sets the body cursor only while resizing", () => {
    store(300);
    const { unmount } = render(<Harness />);
    fireEvent.pointerDown(handle(), { clientX: 300 });
    expect(dragStart()).toBe(false);
    expect(document.body.style.cursor).toBe("ew-resize");
    expect(document.body.style.userSelect).toBe("none");
    fireEvent.pointerUp(handle(), { clientX: 300 });
    expect(dragStart()).toBe(true);
    expect(document.body.style.cursor).toBe("");
    fireEvent.pointerDown(handle(), { clientX: 300 });
    unmount();
    expect(dragStart()).toBe(true);
    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
  });

  it("resets to the default on double click", () => {
    store(400);
    render(<Harness />);
    fireEvent.doubleClick(handle());
    expect(persisted()).toBe(DEFAULT);
    expect(boxWidth()).toBe(`${DEFAULT}px`);
  });

  it("resizes with the keyboard within the clamp", () => {
    store(300);
    render(<Harness />);
    fireEvent.keyDown(handle(), { key: "ArrowRight" });
    expect(persisted()).toBe(316);
    fireEvent.keyDown(handle(), { key: "ArrowLeft" });
    expect(persisted()).toBe(300);
    fireEvent.keyDown(handle(), { key: "Home" });
    expect(persisted()).toBe(MIN);
    fireEvent.keyDown(handle(), { key: "End" });
    expect(persisted()).toBe(MAX);
  });

  it("starts from the rendered width when it is narrower than the chosen one", () => {
    store(400);
    render(<Harness renderedWidth={250} />);
    fireEvent.keyDown(handle(), { key: "ArrowRight" });
    expect(persisted()).toBe(266);
    drag(0, 10);
    expect(persisted()).toBe(260);
  });

  it("keeps the value in memory when storage fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    render(<Harness />);
    fireEvent.keyDown(handle(), { key: "ArrowRight" });
    expect(boxWidth()).toBe(`${DEFAULT + 16}px`);
  });
});

describe("useResizableWidth in live CSS mode", () => {
  it("writes the stored width to the custom property on mount", () => {
    store(320);
    render(<Harness live />);
    expect(cssWidth()).toBe("320px");
  });

  it("drags through the custom property without rendering and commits on release", () => {
    store(300);
    const onRender = vi.fn();
    render(
      <Profiler id="live" onRender={onRender}>
        <Harness live />
      </Profiler>
    );
    fireEvent.pointerDown(handle(), { clientX: 300 });
    onRender.mockClear();
    fireEvent.pointerMove(handle(), { clientX: 340 });
    fireEvent.pointerMove(handle(), { clientX: 360 });
    expect(onRender).not.toHaveBeenCalled();
    expect(cssWidth()).toBe("360px");
    expect(boxWidth()).toBe("300px");
    expect(persisted()).toBe(300);
    fireEvent.pointerUp(handle(), { clientX: 360 });
    expect(persisted()).toBe(360);
    expect(cssWidth()).toBe("360px");
  });

  it("restores the custom property on pointercancel", () => {
    store(300);
    render(<Harness live />);
    fireEvent.pointerDown(handle(), { clientX: 300 });
    fireEvent.pointerMove(handle(), { clientX: 400 });
    fireEvent.pointerCancel(handle(), { clientX: 0 });
    expect(cssWidth()).toBe("300px");
    expect(persisted()).toBe(300);
  });

  it("updates the custom property on keyboard and reset", () => {
    store(300);
    render(<Harness live />);
    fireEvent.keyDown(handle(), { key: "ArrowLeft" });
    expect(cssWidth()).toBe("284px");
    fireEvent.doubleClick(handle());
    expect(cssWidth()).toBe(`${DEFAULT}px`);
  });
});
