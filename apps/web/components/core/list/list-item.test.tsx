/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { findNestedInteractive } from "@/lib/testing/nested-interactive";
import { ListItem } from "./list-item";

const push = vi.fn();
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push }) }));

const renderItem = (onToggle = vi.fn()) =>
  render(
    <ListItem
      id="item-1"
      title="Roadmap"
      itemLink="/ws/projects/p1/pages/1"
      parentRef={createRef<HTMLDivElement>()}
      prependTitleElement={
        <button type="button" onClick={onToggle}>
          Expand
        </button>
      }
      appendTitleElement={<span>3 days ago</span>}
      quickActionElement={<button type="button">More</button>}
      actionableItems={<button type="button">Favorite</button>}
    />
  );

describe("ListItem", () => {
  it("renders no nested interactive elements", () => {
    const { container } = renderItem();
    expect(findNestedInteractive(container)).toEqual([]);
  });

  it("links the title to the item", () => {
    renderItem();
    const link = screen.getByRole("link", { name: "Roadmap" });
    expect(link.getAttribute("href")).toBe("/ws/projects/p1/pages/1");
    expect(link.id).toBe("item-1");
    fireEvent.click(link);
    expect(push).toHaveBeenCalledWith("/ws/projects/p1/pages/1");
  });

  it("runs a title control without navigating", () => {
    push.mockClear();
    const onToggle = vi.fn();
    renderItem(onToggle);
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(onToggle).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
