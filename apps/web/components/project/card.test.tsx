// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { EUserPermissions } from "@plane/constants";
import type { IProject } from "@plane/types";
import { ProjectCard } from "./card";

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "ws" }) }));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ getUserDetails: (id: string) => ({ id, display_name: id, avatar_url: "" }) }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ addProjectToFavorites: vi.fn(), removeProjectFromFavorites: vi.fn() }),
}));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => true }) }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: vi.fn() }) }));
vi.mock("./delete-project-modal", () => ({ DeleteProjectModal: () => null }));
vi.mock("./archive-restore-modal", () => ({ ArchiveRestoreProjectModal: () => null }));
vi.mock("./join-project-modal", () => ({
  JoinProjectModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <dialog open>join</dialog> : null),
}));

const baseProject: IProject = {
  id: "p1",
  name: "Demo",
  identifier: "DEMO",
  sort_order: null,
  logo_props: { in_use: "emoji", emoji: { value: "1f680" } },
  archived_at: null,
  workspace: "ws",
  cycle_view: true,
  issue_views_view: true,
  module_view: true,
  page_view: true,
  issue_view: true,
  inbox_view: false,
  network: 2,
  created_at: new Date("2026-01-01T00:00:00Z"),
  members: ["u1", "u2"],
  is_favorite: false,
};

const renderCard = (overrides: Partial<IProject>) => {
  return render(
    <MemoryRouter>
      <ProjectCard project={{ ...baseProject, ...overrides }} />
    </MemoryRouter>
  );
};

const NESTED_INTERACTIVE = "a a, a button, button a, button button";

describe("ProjectCard", () => {
  it.each([
    ["admin", { member_role: EUserPermissions.ADMIN }],
    ["guest", { member_role: EUserPermissions.GUEST }],
    ["non-member", { member_role: null }],
    ["archived", { member_role: EUserPermissions.ADMIN, archived_at: "2026-02-01T00:00:00Z" }],
  ])("renders no nested interactive elements for an %s", (_, overrides) => {
    const { container } = renderCard(overrides);
    expect(container.querySelectorAll(NESTED_INTERACTIVE)).toHaveLength(0);
  });

  it("links the card and the settings action to their own targets", () => {
    renderCard({ member_role: EUserPermissions.ADMIN });
    expect(screen.getByRole("link", { name: "Demo" }).getAttribute("href")).toBe("/ws/projects/p1/");
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href")).toBe("/ws/settings/projects/p1/");
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
  });

  it("opens the join modal from the join button", () => {
    renderCard({ member_role: null });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("opens the join modal instead of navigating for a non-member", () => {
    renderCard({ member_role: null });
    expect(fireEvent.click(screen.getByRole("link", { name: "Demo" }))).toBe(false);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
