// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StickiesList } from "./stickies-list";

const sticky = vi.hoisted(() => {
  const state: { fetchError: boolean } = { fetchError: false };
  return { state, fetchWorkspaceStickies: vi.fn() };
});

vi.mock("next/navigation", () => ({ usePathname: () => "/ws/stickies" }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@/hooks/use-stickies", () => ({
  useSticky: () => ({
    getWorkspaceStickyIds: () => [],
    toggleShowNewSticky: vi.fn(),
    searchQuery: "",
    loader: "loaded",
    fetchError: sticky.state.fetchError,
    fetchWorkspaceStickies: sticky.fetchWorkspaceStickies,
  }),
}));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => true }) }));
vi.mock("../sticky/use-operations", () => ({ useStickyOperations: () => ({ stickyOperations: {} }) }));
vi.mock("@/components/empty-state/detailed-empty-state-root", () => ({
  DetailedEmptyState: () => <div data-testid="empty" />,
}));

afterEach(() => {
  sticky.state.fetchError = false;
  vi.clearAllMocks();
});

describe("StickiesList", () => {
  it("shows a retry instead of the empty state when the fetch failed", () => {
    sticky.state.fetchError = true;
    render(<StickiesList workspaceSlug="ws" columnCount={3} />);
    expect(screen.queryByTestId("empty")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    expect(sticky.fetchWorkspaceStickies).toHaveBeenCalledWith("ws");
  });

  it("shows the empty state when the workspace has no stickies", () => {
    render(<StickiesList workspaceSlug="ws" columnCount={3} />);
    expect(screen.getByTestId("empty")).toBeTruthy();
  });
});
