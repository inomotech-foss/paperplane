// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { PageNavigationPaneInfoTabActorsInfo } from "./actors-info";

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "ws" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    getUserDetails: (id: string) => (id === "u1" ? { id, display_name: "Member", avatar_url: "" } : undefined),
  }),
}));

describe("PageNavigationPaneInfoTabActorsInfo", () => {
  it("shows the creator as the editor of a page nobody has edited yet", () => {
    render(
      <MemoryRouter>
        <PageNavigationPaneInfoTabActorsInfo
          page={{
            owned_by: "u1",
            created_by: "u1",
            created_at: "2026-11-01T16:59:00Z",
            updated_by: undefined,
            updated_at: "2026-11-01T16:59:00Z",
          }}
        />
      </MemoryRouter>
    );
    expect(screen.queryByText("common.deactivated_user")).toBeNull();
    expect(screen.getAllByText("Member")).toHaveLength(2);
  });
});
