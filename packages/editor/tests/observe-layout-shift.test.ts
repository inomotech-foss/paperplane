// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observeLayoutShift } from "@/helpers/observe-layout-shift";

let callback: ResizeObserverCallback = () => {};
const observed: Element[] = [];
const disconnect = vi.fn();

class FakeResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    callback = cb;
  }
  observe(target: Element) {
    observed.push(target);
  }
  unobserve() {}
  disconnect = disconnect;
}

const resize = (target: Element, width: number, height = 100) => {
  const rect = { x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height };
  const entry: ResizeObserverEntry = {
    target,
    contentRect: { ...rect, toJSON: () => rect },
    borderBoxSize: [],
    contentBoxSize: [],
    devicePixelContentBoxSize: [],
  };
  callback([entry], { observe() {}, unobserve() {}, disconnect() {} });
};

describe("observeLayoutShift", () => {
  beforeEach(() => {
    observed.length = 0;
    disconnect.mockClear();
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("observes the element and its ancestors below the body", () => {
    const outer = document.createElement("div");
    const inner = document.createElement("div");
    outer.appendChild(inner);
    document.body.appendChild(outer);

    observeLayoutShift(inner, () => {});

    expect(observed).toEqual([inner, outer]);
  });

  it("fires on width changes but not on the first report or height changes", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const onShift = vi.fn();
    const stop = observeLayoutShift(element, onShift);

    resize(element, 720);
    resize(element, 720, 400);
    expect(onShift).not.toHaveBeenCalled();

    resize(element, 600);
    expect(onShift).toHaveBeenCalledOnce();

    stop();
    expect(disconnect).toHaveBeenCalled();
  });
});
