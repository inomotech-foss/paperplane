/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoScroller } from "./use-auto-scroller";

const scrollBy = vi.fn();

function Harness({ isDragging, getLeftOffset }: { isDragging: boolean; getLeftOffset: (c: HTMLDivElement) => number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useAutoScroller(containerRef, isDragging, getLeftOffset);
  return <div ref={containerRef} data-testid="container" />;
}

beforeEach(() => {
  vi.useFakeTimers();
  scrollBy.mockClear();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 500 })
  );
  Object.defineProperty(HTMLElement.prototype, "scrollBy", { configurable: true, value: scrollBy });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useAutoScroller", () => {
  it("reads the left offset from the container when a drag starts", () => {
    const getLeftOffset = vi.fn(() => 400);
    const { rerender } = render(<Harness isDragging={false} getLeftOffset={getLeftOffset} />);
    rerender(<Harness isDragging getLeftOffset={getLeftOffset} />);
    expect(getLeftOffset).toHaveBeenCalledWith(screen.getByTestId("container"));
  });

  it("scrolls left near the start of the area after the offset", () => {
    render(<Harness isDragging getLeftOffset={() => 400} />);
    fireEvent.mouseMove(screen.getByTestId("container"), { clientX: 450, clientY: 250 });
    expect(scrollBy).toHaveBeenCalledWith(-3, 0);
  });

  it("does not scroll in the middle of the area after the offset", () => {
    render(<Harness isDragging getLeftOffset={() => 0} />);
    fireEvent.mouseMove(screen.getByTestId("container"), { clientX: 450, clientY: 250 });
    expect(scrollBy).not.toHaveBeenCalled();
  });
});
