/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { WORKSPACE_SIDEBAR_DYNAMIC_NAVIGATION_ITEMS } from "@plane/constants";
import { ExtendedSidebarItem } from "./extended-sidebar-item";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dev/projects/",
  useParams: () => ({ workspaceSlug: "dev" }),
}));

vi.mock("@/hooks/store/use-app-theme", () => ({
  useAppTheme: () => ({ toggleExtendedSidebar: vi.fn() }),
}));

vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "user" } }),
  useUserPermissions: () => ({ allowPermissions: () => true }),
}));

vi.mock("@/hooks/use-navigation-preferences", () => ({
  useWorkspaceNavigationPreferences: () => ({ preferences: { items: {} }, toggleWorkspaceItem: vi.fn() }),
}));

describe("ExtendedSidebarItem", () => {
  it("renders the drag handle as the tooltip trigger without nesting buttons", () => {
    const { container } = render(
      <MemoryRouter>
        <ExtendedSidebarItem item={WORKSPACE_SIDEBAR_DYNAMIC_NAVIGATION_ITEMS["views"]} isLastChild={false} />
      </MemoryRouter>
    );
    expect(container.querySelectorAll("button button")).toHaveLength(0);
    expect(container.querySelectorAll("button[aria-label='Drag to rearrange']")).toHaveLength(1);
  });
});
