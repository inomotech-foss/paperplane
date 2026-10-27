/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useExpandableSearch } from "./use-expandable-search";

function Harness({ onClose }: { onClose: () => void }) {
  const { isOpen, containerRef, inputRef, handleMouseDown, handleFocus } = useExpandableSearch({ onClose });
  return (
    <>
      <div ref={containerRef} data-testid="panel" data-open={isOpen}>
        <input ref={inputRef} aria-label="Search" onMouseDown={handleMouseDown} onFocus={handleFocus} />
        {isOpen && <button type="button">Workspace level</button>}
      </div>
      <button type="button">Outside</button>
    </>
  );
}

const isOpen = () => screen.getByTestId("panel").dataset.open === "true";

const openByClick = () => {
  const input = screen.getByRole("textbox", { name: "Search" });
  fireEvent.mouseDown(input);
  fireEvent.focus(input);
  return input;
};

describe("useExpandableSearch", () => {
  it("opens on a click into the input but not on programmatic focus", () => {
    render(<Harness onClose={vi.fn()} />);
    fireEvent.focus(screen.getByRole("textbox", { name: "Search" }));
    expect(isOpen()).toBe(false);
    openByClick();
    expect(isOpen()).toBe(true);
  });

  it("closes on Escape when focus has moved to another control inside the panel", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    openByClick();
    const toggle = screen.getByRole("button", { name: "Workspace level" });
    toggle.focus();
    fireEvent.keyDown(toggle, { key: "Escape" });
    expect(isOpen()).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape when focus has left the panel entirely", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    openByClick();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(isOpen()).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves an Escape that a child already handled alone, and ignores Escape while closed", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    const input = openByClick();
    const handled = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    handled.preventDefault();
    input.dispatchEvent(handled);
    expect(isOpen()).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on a mousedown outside the panel", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    openByClick();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }));
    expect(isOpen()).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
