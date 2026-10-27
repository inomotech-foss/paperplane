/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { TPowerKCommandConfig } from "@/components/power-k/core/types";
import type { TPowerKCommandsListProps } from "@/components/power-k/ui/modal/commands-list";
import { TopNavPowerK } from "./top-nav-power-k";

const setActivePage = vi.fn();

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "ws" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "u1" } }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ issue: { getIssueById: () => undefined, getIssueIdByIdentifier: () => undefined } }),
}));
vi.mock("@/hooks/store/use-power-k", () => ({
  usePowerK: () => ({ activeContext: null, activePage: null, setActivePage, setTopNavInputRef: vi.fn() }),
}));
// The real list and footer pull in the whole command registry; a page-switching command and a
// focusable footer control are all these tests need
vi.mock("@/components/power-k/ui/modal/commands-list", () => {
  const openProject: TPowerKCommandConfig = {
    id: "open_project",
    i18n_title: "power_k.navigation_actions.open_project",
    group: "navigation",
    type: "change-page",
    page: "open-project",
    onSelect: () => {},
    closeOnSelect: true,
    isVisible: () => true,
    isEnabled: () => true,
  };
  return {
    ProjectsAppPowerKCommandsList: ({ handleCommandSelect }: TPowerKCommandsListProps) => (
      <button type="button" onClick={() => handleCommandSelect(openProject)}>
        Open a project
      </button>
    ),
  };
});
vi.mock("@/components/power-k/ui/modal/footer", () => ({
  PowerKModalFooter: () => <button type="button">Workspace level</button>,
}));

// cmdk's list measures itself with a ResizeObserver, which jsdom does not provide
class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  if (!("ResizeObserver" in window)) Object.defineProperty(window, "ResizeObserver", { value: TestResizeObserver });
});

const getInput = () => screen.getByPlaceholderText("Search commands...");
const queryCommand = () => screen.queryByRole("button", { name: "Open a project" });
const queryClose = () => screen.queryByRole("button", { name: "close" });

const openByClick = () => {
  const input = getInput();
  fireEvent.mouseDown(input);
  fireEvent.focus(input);
  return input;
};

describe("TopNavPowerK", () => {
  beforeEach(() => {
    setActivePage.mockClear();
  });

  it("shows the commands and a close button only while expanded", () => {
    render(<TopNavPowerK />);
    expect(queryCommand()).toBeNull();
    expect(queryClose()).toBeNull();
    openByClick();
    expect(queryCommand()).not.toBeNull();
    expect(queryClose()).not.toBeNull();
  });

  it("collapses from the close button", () => {
    render(<TopNavPowerK />);
    openByClick();
    fireEvent.click(queryClose()!);
    expect(queryCommand()).toBeNull();
    expect(queryClose()).toBeNull();
  });

  it("keeps the input focused after a command switches pages", () => {
    render(<TopNavPowerK />);
    const input = openByClick();
    // A real click on a command lands focus outside the input
    screen.getByRole("button", { name: "Workspace level" }).focus();
    fireEvent.click(queryCommand()!);
    expect(setActivePage).toHaveBeenCalledWith("open-project");
    expect(document.activeElement).toBe(input);
    expect(queryCommand()).not.toBeNull();
  });

  it("collapses on Escape when focus is on another control inside the panel", () => {
    render(<TopNavPowerK />);
    openByClick();
    const toggle = screen.getByRole("button", { name: "Workspace level" });
    toggle.focus();
    fireEvent.keyDown(toggle, { key: "Escape" });
    expect(queryCommand()).toBeNull();
  });

  it("collapses on a mousedown outside the panel", () => {
    // `observer` wraps the component in `memo`, where React 19.2 never updates a `useEffectEvent`
    render(
      <>
        <TopNavPowerK />
        <button type="button">Elsewhere</button>
      </>
    );
    openByClick();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Elsewhere" }));
    expect(queryCommand()).toBeNull();
  });

  it("collapses on Escape typed into the input and clears the search term", () => {
    render(<TopNavPowerK />);
    const input = openByClick();
    fireEvent.change(input, { target: { value: "proj" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(queryCommand()).toBeNull();
    expect(getInput()).toHaveProperty("value", "");
  });
});
