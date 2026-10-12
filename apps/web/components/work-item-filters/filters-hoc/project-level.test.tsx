// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { StrictMode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { IIssueFilters } from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
import { store } from "@/lib/store-context";
import { WorkItemFiltersToggle } from "../filters-toggle";
import { ProjectLevelWorkItemFiltersHOC } from "./project-level";

const PROJECT_ID = "project-1";

const loadedFilters: IIssueFilters = {
  richFilters: { state_id__in: "state-1" },
  displayFilters: { group_by: null },
  displayProperties: undefined,
  kanbanFilters: undefined,
};

// the header toggle and the layout, wired to the real store as on the work items page
function Page({ filters }: { filters: IIssueFilters | undefined }) {
  return (
    <MemoryRouter>
      <StrictMode>
        <WorkItemFiltersToggle entityType={EIssuesStoreType.PROJECT} entityId={PROJECT_ID} />
        <ProjectLevelWorkItemFiltersHOC
          enableSaveView
          entityType={EIssuesStoreType.PROJECT}
          entityId={PROJECT_ID}
          filtersToShowByLayout={["state_id", "priority"]}
          initialWorkItemFilters={filters}
          updateFilters={async () => {}}
          projectId={PROJECT_ID}
          workspaceSlug="ws"
        >
          {({ filter }) => <span data-testid="child">{filter ? "ready" : "missing"}</span>}
        </ProjectLevelWorkItemFiltersHOC>
      </StrictMode>
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProjectLevelWorkItemFiltersHOC", () => {
  it("logs no React error while the filters load and change", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { getByTestId, rerender } = render(<Page filters={undefined} />);
    rerender(<Page filters={loadedFilters} />);
    rerender(<Page filters={{ ...loadedFilters, richFilters: {} }} />);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(store.workItemFilters.getFilter(EIssuesStoreType.PROJECT, PROJECT_ID)).toBeDefined();
    expect(getByTestId("child").textContent).toBe("ready");
  });
});
