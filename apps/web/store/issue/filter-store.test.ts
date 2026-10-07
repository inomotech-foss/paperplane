// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { afterEach, describe, expect, it, vi } from "vitest";
import { EIssueFilterType } from "@plane/constants";
import type { TWorkItemFilterExpression } from "@plane/types";
import { ArchivedIssuesFilter } from "./archived/filter.store";
import { ProjectViewIssuesFilter } from "./project-views/filter.store";
import type { IIssueRootStore } from "./root.store";

const makeRootStore = () =>
  ({
    projectIssues: { clear: vi.fn(), fetchIssuesWithExistingPagination: vi.fn() },
    projectViewIssues: { clear: vi.fn(), fetchIssuesWithExistingPagination: vi.fn() },
    archivedIssues: { clear: vi.fn(), fetchIssuesWithExistingPagination: vi.fn() },
  }) as unknown as IIssueRootStore;

afterEach(() => {
  localStorage.clear();
});

describe("ArchivedIssuesFilter", () => {
  it("restores rich filters from local storage", async () => {
    const richFilters = { state_id__in: "s1" } as unknown as TWorkItemFilterExpression;
    await new ArchivedIssuesFilter(makeRootStore()).updateFilterExpression("ws", "p1", richFilters);

    const store = new ArchivedIssuesFilter(makeRootStore());
    await store.fetchFilters("ws", "p1");

    expect(store.getIssueFilters("p1")?.richFilters).toEqual(richFilters);
  });
});

describe("ProjectViewIssuesFilter", () => {
  it("clears the project view issues when the layout changes", async () => {
    const root = makeRootStore();
    const store = new ProjectViewIssuesFilter(root);
    store.filters = {
      v1: {
        richFilters: {},
        displayFilters: {},
        displayProperties: {},
        kanbanFilters: { group_by: [], sub_group_by: [] },
      },
    };

    await store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { layout: "list" }, "v1");

    expect(root.projectViewIssues.clear).toHaveBeenCalledWith(true);
    expect(root.projectIssues.clear).not.toHaveBeenCalled();
  });
});
