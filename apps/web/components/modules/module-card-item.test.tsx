/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { findNestedInteractive } from "@/lib/testing/nested-interactive";
import { ModuleCardItem } from "./module-card-item";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "ws", projectId: "p1" }),
  usePathname: () => "/ws/projects/p1/modules",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: () => undefined }) }));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: () => true }),
  useUserProfile: () => ({ data: { start_of_the_week: 0 } }),
}));
vi.mock("@/hooks/store/use-module", () => ({
  useModule: () => ({
    getModuleById: () => ({
      id: "m1",
      name: "Launch",
      project_id: "p1",
      status: "in-progress",
      lead_id: null,
      start_date: null,
      target_date: null,
      archived_at: null,
      is_favorite: false,
      backlog_issues: 1,
      unstarted_issues: 0,
      started_issues: 1,
      completed_issues: 2,
      cancelled_issues: 0,
    }),
    addModuleToFavorites: vi.fn(),
    removeModuleFromFavorites: vi.fn(),
    updateModuleDetails: vi.fn(),
  }),
}));
vi.mock("@/components/modules/module-status-dropdown", () => ({
  ModuleStatusDropdown: () => <button type="button">Status</button>,
}));
vi.mock("@/components/modules", () => ({ ModuleQuickActions: () => <button type="button">Menu</button> }));

const renderCard = () =>
  render(
    <MemoryRouter>
      <ModuleCardItem moduleId="m1" />
    </MemoryRouter>
  );

describe("ModuleCardItem", () => {
  it("renders no nested interactive elements", () => {
    const { container } = renderCard();
    expect(findNestedInteractive(container)).toEqual([]);
  });

  it("links the title to the module and keeps the details button separate", () => {
    renderCard();
    expect(screen.getByRole("link", { name: "Launch" }).getAttribute("href")).toBe("/ws/projects/p1/modules/m1/");
    fireEvent.click(screen.getByRole("button", { name: "Module details" }));
    expect(push).toHaveBeenCalledWith("/ws/projects/p1/modules?peekModule=m1");
  });
});
