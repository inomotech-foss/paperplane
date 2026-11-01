/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { findNestedInteractive } from "@/lib/testing/nested-interactive";
import { findLinkOffsetParents, findStackingTraps } from "@/lib/testing/stacking";
import { ListItem } from "./list-item";

const renderItem = (onToggle = vi.fn()) =>
  render(
    <MemoryRouter>
      <Routes>
        <Route
          path="/"
          element={
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
          }
        />
        <Route path="/ws/projects/p1/pages/1/" element={<p>Page opened</p>} />
      </Routes>
    </MemoryRouter>
  );

describe("ListItem", () => {
  it("renders no nested interactive elements", () => {
    const { container } = renderItem();
    expect(findNestedInteractive(container)).toEqual([]);
  });

  it("links the title to the item", () => {
    renderItem();
    const link = screen.getByRole("link", { name: "Roadmap" });
    expect(link.getAttribute("href")).toBe("/ws/projects/p1/pages/1/");
    expect(link.id).toBe("item-1");
    expect(fireEvent.click(link)).toBe(false);
    expect(screen.getByText("Page opened")).toBeTruthy();
  });

  it("runs a title control without navigating", () => {
    const onToggle = vi.fn();
    renderItem(onToggle);
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(onToggle).toHaveBeenCalled();
    expect(screen.queryByText("Page opened")).toBeNull();
  });

  it("keeps the title controls above the item link", () => {
    renderItem();
    const card = screen.getByRole("link", { name: "Roadmap" }).closest(".isolate");
    expect(card).not.toBeNull();
    const raised = screen.getByRole("button", { name: "Expand" }).closest(".z-\\[2\\]");
    expect(raised).not.toBeNull();
    expect(card?.contains(raised)).toBe(true);
    if (card) {
      expect(findStackingTraps(card)).toEqual([]);
      expect(findLinkOffsetParents(card)).toEqual([]);
    }
  });
});
