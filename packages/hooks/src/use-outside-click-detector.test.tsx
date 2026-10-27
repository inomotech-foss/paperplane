/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentType } from "react";
import { memo, useRef, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOutsideClickDetector } from "./use-outside-click-detector";

type HarnessProps = { onOutside: (count: number) => void };

// The callback closes over state that changes after mount, which the hook must keep up with
function useHarness({ onOutside }: HarnessProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  useOutsideClickDetector(panelRef, () => onOutside(count));
  return (
    <>
      <div ref={panelRef}>
        <button type="button">Inside</button>
      </div>
      <button type="button" onClick={() => setCount((c) => c + 1)}>
        Bump
      </button>
      <button type="button">Outside</button>
    </>
  );
}

const Plain = (props: HarnessProps) => useHarness(props);
// What mobx's `observer` produces: React commits these fibers on a different path than plain
// function components and (as of 19.2) never applies `useEffectEvent` updates to them
const Memoized = memo(function Memoized(props: HarnessProps) {
  return useHarness(props);
});

const cases: [string, ComponentType<HarnessProps>][] = [
  ["plain", Plain],
  ["memo", Memoized],
];

describe("useOutsideClickDetector", () => {
  // The hooks package has no shared vitest setup, so unmount between cases by hand
  afterEach(() => cleanup());

  it.each(cases)("calls the latest callback after re-renders in a %s component", (_, Harness) => {
    const onOutside = vi.fn();
    render(<Harness onOutside={onOutside} />);
    fireEvent.click(screen.getByRole("button", { name: "Bump" }));
    fireEvent.click(screen.getByRole("button", { name: "Bump" }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }));
    expect(onOutside).toHaveBeenCalledTimes(1);
    expect(onOutside).toHaveBeenCalledWith(2);
  });

  it("ignores presses inside the element", () => {
    const onOutside = vi.fn();
    render(<Memoized onOutside={onOutside} />);
    fireEvent.mouseDown(screen.getByRole("button", { name: "Inside" }));
    expect(onOutside).not.toHaveBeenCalled();
  });
});
