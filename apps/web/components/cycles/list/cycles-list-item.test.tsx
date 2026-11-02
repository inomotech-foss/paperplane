// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { ICycle } from "@plane/types";
import { CyclesListItem } from "./cycles-list-item";

const completed: ICycle = {
  id: "c1",
  workspace_id: "w1",
  project_id: "p1",
  name: "Sprint 1",
  description: "",
  start_date: "2026-01-01",
  end_date: "2026-01-14",
  owned_by_id: "u1",
  sort_order: 1,
  status: "completed",
  total_issues: 5,
  completed_issues: 2,
  cancelled_issues: 0,
};

vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "ws", projectId: "p1" }),
  usePathname: () => "/ws/projects/p1/cycles",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: () => undefined }) }));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: () => true }),
  useUserProfile: () => ({ data: { start_of_the_week: 0 } }),
  useUser: () => ({ data: { user_timezone: "UTC" } }),
}));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ getProjectById: () => undefined }) }));
vi.mock("@/hooks/store/use-cycle", () => ({
  useCycle: () => ({
    getCycleById: () => completed,
    addCycleToFavorites: vi.fn(),
    removeCycleFromFavorites: vi.fn(),
  }),
}));
vi.mock("../quick-actions", () => ({ CycleQuickActions: () => <span data-testid="quick-actions" /> }));
vi.mock("../transfer-issues-modal", () => ({ TransferIssuesModal: () => <span data-testid="transfer-modal" /> }));

const renderRow = () =>
  render(
    <MemoryRouter>
      <CyclesListItem cycleId="c1" workspaceSlug="ws" projectId="p1" />
    </MemoryRouter>
  );

describe("CyclesListItem", () => {
  it("mounts one quick actions menu per row", () => {
    renderRow();
    expect(screen.getAllByTestId("quick-actions")).toHaveLength(1);
  });

  it("mounts the transfer dialog only once it is opened", () => {
    renderRow();
    expect(screen.queryByTestId("transfer-modal")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /transfer/i }));
    expect(screen.getByTestId("transfer-modal")).toBeTruthy();
  });
});
