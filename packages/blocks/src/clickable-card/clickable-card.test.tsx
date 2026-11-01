/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClickableCard, ClickableCardLink, ClickableCardRaised } from "./clickable-card";

const renderCard = (onLinkClick = vi.fn(), onAction = vi.fn()) =>
  render(
    <ClickableCard data-testid="card" className="rounded-lg">
      <ClickableCardLink href="/ws/items/1" onClick={onLinkClick}>
        Roadmap
      </ClickableCardLink>
      <ClickableCardRaised>
        <button type="button" onClick={onAction}>
          Favorite
        </button>
      </ClickableCardRaised>
    </ClickableCard>
  );

describe("ClickableCard", () => {
  it("renders an isolated, positioned host", () => {
    renderCard();
    const card = screen.getByTestId("card");
    expect(card.tagName).toBe("DIV");
    expect(card.className.split(" ")).toEqual(expect.arrayContaining(["relative", "isolate", "rounded-lg"]));
  });

  it("can render the host as another element", () => {
    render(
      <ul>
        <ClickableCard render={<li />} data-testid="item">
          Roadmap
        </ClickableCard>
      </ul>
    );
    const item = screen.getByTestId("item");
    expect(item.tagName).toBe("LI");
    expect(item.classList.contains("isolate")).toBe(true);
  });

  it("names the link from its children or its aria-label", () => {
    render(
      <>
        <ClickableCardLink href="/a">Roadmap</ClickableCardLink>
        <ClickableCardLink href="/b" aria-label="Demo project" />
      </>
    );
    expect(screen.getByRole("link", { name: "Roadmap" }).getAttribute("href")).toBe("/a");
    expect(screen.getByRole("link", { name: "Demo project" }).getAttribute("href")).toBe("/b");
  });

  it("stretches the link over the card and keeps it out of native drag", () => {
    renderCard();
    const link = screen.getByRole("link", { name: "Roadmap" });
    expect(link.className).toContain("after:absolute");
    expect(link.className).toContain("after:inset-0");
    expect(link.getAttribute("draggable")).toBe("false");
  });

  it("puts the link and the actions in the tab order once each", async () => {
    renderCard();
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Roadmap" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Favorite" }));
    await user.tab();
    expect(document.activeElement).toBe(document.body);
  });

  it("runs the action without the link handler", async () => {
    const onLinkClick = vi.fn();
    const onAction = vi.fn();
    renderCard(onLinkClick, onAction);
    await userEvent.setup().click(screen.getByRole("button", { name: "Favorite" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onLinkClick).not.toHaveBeenCalled();
  });

  it("raises actions above the link", () => {
    renderCard();
    const raised = screen.getByRole("button", { name: "Favorite" }).parentElement;
    expect(raised?.className.split(" ")).toEqual(expect.arrayContaining(["relative", "z-[2]"]));
  });

  it("runs the link handler on a plain click", () => {
    const onLinkClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    renderCard(onLinkClick);
    const notPrevented = fireEvent.click(screen.getByRole("link", { name: "Roadmap" }));
    expect(onLinkClick).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false);
  });

  it.each([
    ["Cmd", { metaKey: true }],
    ["Ctrl", { ctrlKey: true }],
    ["Shift", { shiftKey: true }],
    ["middle", { button: 1 }],
  ])("leaves a %s click to the browser", (_, init) => {
    const onLinkClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    renderCard(onLinkClick);
    // jsdom cannot navigate, so record what the browser would see and stop it here
    let preventedByCard: boolean | undefined;
    const stopNavigation = (event: MouseEvent) => {
      preventedByCard = event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener("click", stopNavigation);
    fireEvent.click(screen.getByRole("link", { name: "Roadmap" }), init);
    document.removeEventListener("click", stopNavigation);
    expect(onLinkClick).not.toHaveBeenCalled();
    expect(preventedByCard).toBe(false);
  });

  it("renders through a router link when given one", () => {
    const RouterLink = vi.fn(({ children, ...props }: React.ComponentPropsWithRef<"a"> & { href: string }) => (
      <a data-router="" {...props}>
        {children}
      </a>
    ));
    render(
      <ClickableCardLink href="/ws/items/1" render={(props) => <RouterLink {...props} />}>
        Roadmap
      </ClickableCardLink>
    );
    const link = screen.getByRole("link", { name: "Roadmap" });
    expect(link.hasAttribute("data-router")).toBe(true);
    expect(link.getAttribute("href")).toBe("/ws/items/1");
  });

  it("renders plain text when disabled", () => {
    render(
      <ClickableCardLink href="/ws/items/1" disabled>
        Roadmap
      </ClickableCardLink>
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Roadmap")).toBeTruthy();
  });
});
