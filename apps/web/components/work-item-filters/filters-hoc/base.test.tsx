// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { StrictMode } from "react";
import { observer } from "mobx-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkItemFilterStore } from "@plane/shared-state";
import type { IWorkItemFilterInstance } from "@plane/shared-state";
import type { IIssueFilters } from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
import { useWorkItemFilters } from "@/hooks/store/work-item-filters/use-work-item-filters";
import { WorkItemFiltersToggle } from "../filters-toggle";
import { WorkItemFiltersHOC } from "./base";

const filterStore = new WorkItemFilterStore();

vi.mock("@/hooks/store/work-item-filters/use-work-item-filters", () => ({
  useWorkItemFilters: () => filterStore,
}));

vi.mock("@/hooks/work-item-filters/use-work-item-filters-config", () => ({
  useWorkItemFiltersConfig: () => ({ areAllConfigsInitialized: true, configs: [] }),
}));

vi.mock("@/components/rich-filters/filters-toggle", () => ({
  FiltersToggle: ({ filter }: { filter: IWorkItemFilterInstance | undefined }) => (
    <span data-testid="toggle">{filter ? "ready" : "missing"}</span>
  ),
}));

const ENTITY_TYPE = EIssuesStoreType.PROJECT;
const ENTITY_ID = "project-1";

const initialWorkItemFilters: IIssueFilters = {
  richFilters: {},
  displayFilters: undefined,
  displayProperties: undefined,
  kanbanFilters: undefined,
};

// reads the filter from the store, like the layouts and sidebars do
const StoreReader = observer(function StoreReader() {
  const { getFilter } = useWorkItemFilters();
  return <span data-testid="reader">{getFilter(ENTITY_TYPE, ENTITY_ID) ? "ready" : "missing"}</span>;
});

function Page({ entityId = ENTITY_ID, loaded = true }: { entityId?: string; loaded?: boolean }) {
  return (
    <>
      <WorkItemFiltersToggle entityType={ENTITY_TYPE} entityId={entityId} />
      <WorkItemFiltersHOC
        entityType={ENTITY_TYPE}
        entityId={entityId}
        filtersToShowByLayout={[]}
        initialWorkItemFilters={loaded ? initialWorkItemFilters : undefined}
        updateFilters={() => {}}
        workspaceSlug="ws"
      >
        {({ filter }) => (
          <>
            <span data-testid="child">{filter ? "ready" : "missing"}</span>
            <StoreReader />
          </>
        )}
      </WorkItemFiltersHOC>
    </>
  );
}

const renderWarnings = (calls: unknown[][]) =>
  calls.filter((args) => String(args[0]).includes("Cannot update a component"));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WorkItemFiltersHOC", () => {
  it("creates the filter without updating other components during render", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // the header is mounted before the stored filters have loaded
    const { rerender } = render(<Page loaded={false} />);
    expect(screen.getByTestId("toggle").textContent).toBe("missing");

    rerender(<Page />);
    rerender(<Page />);

    expect(renderWarnings(errorSpy.mock.calls)).toEqual([]);
    expect(screen.getByTestId("child").textContent).toBe("ready");
    expect(screen.getByTestId("reader").textContent).toBe("ready");
    expect(screen.getByTestId("toggle").textContent).toBe("ready");
  });

  it("never renders children without a filter", () => {
    const seen: (IWorkItemFilterInstance | undefined)[] = [];
    render(
      <WorkItemFiltersHOC
        entityType={ENTITY_TYPE}
        entityId={ENTITY_ID}
        filtersToShowByLayout={[]}
        initialWorkItemFilters={initialWorkItemFilters}
        updateFilters={() => {}}
        workspaceSlug="ws"
      >
        {({ filter }) => {
          seen.push(filter);
          return null;
        }}
      </WorkItemFiltersHOC>
    );

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((filter) => filter !== undefined)).toBe(true);
  });

  it("deletes the filter on unmount and recreates it for a new entity", () => {
    const { rerender, unmount } = render(<Page />);
    expect(filterStore.getFilter(ENTITY_TYPE, ENTITY_ID)).toBeDefined();

    rerender(<Page entityId="project-2" />);
    expect(filterStore.getFilter(ENTITY_TYPE, ENTITY_ID)).toBeUndefined();
    expect(filterStore.getFilter(ENTITY_TYPE, "project-2")).toBeDefined();

    unmount();
    expect(filterStore.getFilter(ENTITY_TYPE, "project-2")).toBeUndefined();
  });

  it("keeps the change callback current", () => {
    const renderWith = (updateFilters: () => void) => (
      <WorkItemFiltersHOC
        entityType={ENTITY_TYPE}
        entityId={ENTITY_ID}
        filtersToShowByLayout={[]}
        initialWorkItemFilters={initialWorkItemFilters}
        updateFilters={updateFilters}
        workspaceSlug="ws"
      >
        {null}
      </WorkItemFiltersHOC>
    );
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(renderWith(first));
    const filter = filterStore.getFilter(ENTITY_TYPE, ENTITY_ID);
    expect(filter?.onExpressionChange).toBe(first);

    rerender(renderWith(second));
    expect(filterStore.getFilter(ENTITY_TYPE, ENTITY_ID)).toBe(filter);
    expect(filter?.onExpressionChange).toBe(second);
  });

  it("keeps the filter in the store under strict mode", () => {
    render(
      <StrictMode>
        <Page />
      </StrictMode>
    );

    expect(filterStore.getFilter(ENTITY_TYPE, ENTITY_ID)).toBeDefined();
    expect(screen.getByTestId("child").textContent).toBe("ready");
  });
});
