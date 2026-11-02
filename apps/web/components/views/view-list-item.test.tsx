// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { IProjectView } from "@plane/types";
import { EViewAccess } from "@plane/types";
import { ProjectViewListItem } from "./view-list-item";

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "ws", projectId: "p1" }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: () => undefined }) }));
vi.mock("@/hooks/store/use-project-view", () => ({
  useProjectView: () => ({ addViewToFavorites: vi.fn(), removeViewFromFavorites: vi.fn() }),
}));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => true }) }));
vi.mock("../dropdowns/member/avatar", () => ({ ButtonAvatars: () => null }));
vi.mock("./quick-actions", () => ({
  ViewQuickActions: () => <span data-testid="quick-actions" />,
  ViewQuickActionDialogs: () => null,
}));

const view: IProjectView = {
  id: "v1",
  name: "Open bugs",
  description: "",
  access: EViewAccess.PUBLIC,
  created_at: "",
  updated_at: "",
  created_by: null,
  updated_by: null,
  is_favorite: false,
  rich_filters: {},
  display_filters: {},
  display_properties: {},
  project: "p1",
  workspace: "w1",
  logo_props: undefined,
  is_locked: false,
  owned_by: "u1",
};

describe("ProjectViewListItem", () => {
  it("mounts one quick actions menu per row", () => {
    render(
      <MemoryRouter>
        <ProjectViewListItem view={view} />
      </MemoryRouter>
    );
    expect(screen.getAllByTestId("quick-actions")).toHaveLength(1);
  });
});
