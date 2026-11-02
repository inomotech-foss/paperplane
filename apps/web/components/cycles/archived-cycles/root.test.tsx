// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TStoreQueryState } from "@/hooks/queries/use-store-query";
import { ArchivedCycleLayoutRoot } from "./root";

const query = vi.hoisted(() => {
  const state: { current: Omit<TStoreQueryState, "retry" | "ensureLoaded"> } = {
    current: { isLoading: false, error: undefined },
  };
  return { state, retry: vi.fn() };
});
const archivedIds = vi.hoisted(() => ({ current: ["c1"] }));

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "ws", projectId: "p1" }) }));
vi.mock("@/hooks/queries/use-cycle-queries", () => ({
  useArchivedCycles: () => ({ ...query.state.current, retry: query.retry, ensureLoaded: vi.fn() }),
}));
vi.mock("@/hooks/store/use-cycle", () => ({
  useCycle: () => ({ currentProjectArchivedCycleIds: archivedIds.current }),
}));
vi.mock("@/hooks/store/use-cycle-filter", () => ({
  useCycleFilter: () => ({ clearAllFilters: vi.fn(), currentProjectArchivedFilters: {}, updateFilters: vi.fn() }),
}));
vi.mock("@/components/ui/loader/cycle-module-list-loader", () => ({
  CycleModuleListLayoutLoader: () => <div data-testid="skeleton" />,
}));
vi.mock("@plane/blocks/empty-state", () => ({ EmptyStateDetailed: () => <div data-testid="empty" /> }));
vi.mock("./view", () => ({ ArchivedCyclesView: () => <div data-testid="list" /> }));

afterEach(() => {
  query.state.current = { isLoading: false, error: undefined };
  archivedIds.current = ["c1"];
  vi.clearAllMocks();
});

describe("ArchivedCycleLayoutRoot", () => {
  it("shows the skeleton while the archived cycles load", () => {
    query.state.current = { isLoading: true, error: undefined };
    archivedIds.current = [];
    render(<ArchivedCycleLayoutRoot />);
    expect(screen.getByTestId("skeleton")).toBeTruthy();
    expect(screen.queryByTestId("empty")).toBeNull();
  });

  it("shows an error with a retry instead of a skeleton when the fetch fails", () => {
    query.state.current = { isLoading: false, error: new Error("boom") };
    archivedIds.current = [];
    render(<ArchivedCycleLayoutRoot />);
    expect(screen.queryByTestId("skeleton")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    expect(query.retry).toHaveBeenCalledOnce();
  });

  it("shows the empty state only once the fetch answered", () => {
    archivedIds.current = [];
    render(<ArchivedCycleLayoutRoot />);
    expect(screen.getByTestId("empty")).toBeTruthy();
  });

  it("lists the archived cycles", () => {
    render(<ArchivedCycleLayoutRoot />);
    expect(screen.getByTestId("list")).toBeTruthy();
  });
});
