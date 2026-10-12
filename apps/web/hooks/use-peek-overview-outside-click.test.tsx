/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import usePeekOverviewOutsideClickDetector from "./use-peek-overview-outside-click";

function Harness({ onOutside }: { onOutside: () => void }) {
  const peekRef = useRef<HTMLDivElement>(null);
  usePeekOverviewOutsideClickDetector(peekRef, onOutside, "i1");
  return (
    <>
      <div ref={peekRef}>peek</div>
      <div data-issue-row="i1">
        <button type="button">Priority</button>
      </div>
      <div data-issue-row="i2">
        <button type="button">Other priority</button>
      </div>
    </>
  );
}

describe("usePeekOverviewOutsideClickDetector", () => {
  it("keeps the peek open for controls on the peeked row only", () => {
    const onOutside = vi.fn();
    render(<Harness onOutside={onOutside} />);
    fireEvent.mouseDown(screen.getByRole("button", { name: "Priority" }));
    expect(onOutside).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Other priority" }));
    expect(onOutside).toHaveBeenCalledTimes(1);
  });
});
