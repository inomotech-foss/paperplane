/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { findNestedInteractive } from "@/lib/testing/nested-interactive";
import { SidebarProjectsListItem } from "./projects-list-item";

const navigation = { mode: "ACCORDION" };
const toggleProjectListOpen = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "ws" }),
  useRouter: () => ({ push }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    getPartialProjectById: () => ({ id: "p1", name: "Demo", logo_props: { in_use: "emoji" }, sort_order: 1 }),
  }),
}));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => true }) }));
vi.mock("@/hooks/store/use-command-palette", () => ({
  useCommandPalette: () => ({ getIsProjectListOpen: () => false, toggleProjectListOpen }),
}));
vi.mock("@/hooks/use-navigation-preferences", () => ({
  useProjectNavigationPreferences: () => ({ preferences: { navigationMode: navigation.mode } }),
}));
vi.mock("@/hooks/store/use-app-theme", () => ({
  useAppTheme: () => ({
    isExtendedProjectSidebarOpened: false,
    toggleExtendedProjectSidebar: vi.fn(),
    toggleAnySidebarDropdown: vi.fn(),
  }),
}));
vi.mock("@/components/project/features/features", () => ({ getProjectUrl: () => "/ws/projects/p1/issues" }));
vi.mock("@/components/project/leave-project-modal", () => ({ LeaveProjectModal: () => null }));
vi.mock("@/components/project/publish-project/modal", () => ({ PublishProjectModal: () => null }));
vi.mock("./project-navigation", () => ({ ProjectNavigation: () => null }));

const renderItem = () =>
  render(
    <SidebarProjectsListItem projectId="p1" handleCopyText={vi.fn()} projectListType="JOINED" isLastChild={false} />
  );

describe("SidebarProjectsListItem", () => {
  it.each(["ACCORDION", "TABBED"])("renders no nested interactive elements in %s mode", (mode) => {
    navigation.mode = mode;
    const { container } = renderItem();
    expect(findNestedInteractive(container)).toEqual([]);
  });

  it("toggles the project in accordion mode and exposes the state on the link", () => {
    navigation.mode = "ACCORDION";
    renderItem();
    const link = screen.getByRole("link", { name: "Demo" });
    expect(link.getAttribute("href")).toBe("/ws/projects/p1/issues");
    expect(link.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(link);
    expect(toggleProjectListOpen).toHaveBeenCalledWith("p1", true);
  });

  it("toggles the project with Space in accordion mode", () => {
    navigation.mode = "ACCORDION";
    toggleProjectListOpen.mockClear();
    renderItem();
    fireEvent.keyDown(screen.getByRole("link", { name: "Demo" }), { key: " " });
    expect(toggleProjectListOpen).toHaveBeenCalledWith("p1", true);
  });

  it("navigates in tabbed mode", () => {
    navigation.mode = "TABBED";
    renderItem();
    const link = screen.getByRole("link", { name: "Demo" });
    expect(link.hasAttribute("aria-expanded")).toBe(false);
    fireEvent.click(link);
    expect(push).toHaveBeenCalledWith("/ws/projects/p1/issues");
  });
});
