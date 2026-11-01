// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent } from "@makeplane/propel/components/dialog";
import { EViewAccess } from "@plane/types";
import type { IProjectView } from "@plane/types";
import { ProjectViewForm } from "./form";

vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ getProjectById: () => undefined }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/components/issues/issue-layouts/filters", () => ({
  DisplayFiltersSelection: () => null,
  FiltersDropdown: () => null,
}));
vi.mock("@/components/work-item-filters/filters-row", () => ({ WorkItemFiltersRow: () => null }));
vi.mock("@/components/work-item-filters/filters-hoc/project-level", () => ({
  ProjectLevelWorkItemFiltersHOC: () => null,
}));
vi.mock("@/components/dropdowns/layout", () => ({ LayoutDropDown: () => null }));
vi.mock("@plane/blocks/emoji-icon-picker", () => ({ EmojiPicker: () => null, Logo: () => null }));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

const view: IProjectView = {
  id: "v1",
  access: EViewAccess.PRIVATE,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  created_by: "u1",
  updated_by: null,
  name: "View",
  description: "",
  rich_filters: {},
  display_filters: {},
  display_properties: {},
  project: "p1",
  workspace: "w1",
  logo_props: undefined,
  is_locked: false,
  owned_by: "u1",
};

describe("ProjectViewForm", () => {
  it("does not send the read-only access field", async () => {
    const handleFormSubmit = vi.fn(async (_values: Partial<IProjectView>) => {});
    render(
      <Dialog open>
        <DialogContent>
          <ProjectViewForm
            data={view}
            handleClose={() => {}}
            handleFormSubmit={handleFormSubmit}
            projectId="p1"
            workspaceSlug="ws"
          />
        </DialogContent>
      </Dialog>
    );

    const form = document.querySelector("form");
    if (!form) throw new Error("form not rendered");
    fireEvent.submit(form);

    await waitFor(() => expect(handleFormSubmit).toHaveBeenCalled());
    expect(handleFormSubmit.mock.calls[0][0]).not.toHaveProperty("access");
  });
});
