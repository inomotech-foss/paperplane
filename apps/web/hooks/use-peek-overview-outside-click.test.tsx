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
        <a href="/i2">Other title</a>
      </div>
      <table>
        <tbody>
          <tr data-issue-row="i1">
            <td id="issue-i1">Title</td>
            <td>
              <button type="button">State</button>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

describe("usePeekOverviewOutsideClickDetector", () => {
  it("keeps the peek open for controls on the peeked row only", () => {
    const onOutside = vi.fn();
    render(<Harness onOutside={onOutside} />);
    fireEvent.mouseDown(screen.getByRole("button", { name: "Priority" }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "State" }));
    expect(onOutside).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Other priority" }));
    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  it("stays open when a link is opened in a new tab", () => {
    const onOutside = vi.fn();
    render(<Harness onOutside={onOutside} />);
    const link = screen.getByRole("link", { name: "Other title" });
    fireEvent.mouseDown(link, { metaKey: true });
    fireEvent.mouseDown(link, { ctrlKey: true });
    fireEvent.mouseDown(link, { button: 1 });
    expect(onOutside).not.toHaveBeenCalled();
    fireEvent.mouseDown(link);
    expect(onOutside).toHaveBeenCalledTimes(1);
  });
});
