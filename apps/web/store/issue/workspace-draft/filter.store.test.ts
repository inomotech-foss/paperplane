// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { afterEach, describe, expect, it, vi } from "vitest";
import { EDraftIssuePaginationType, EIssueFilterType } from "@plane/constants";
import { EIssuesStoreType } from "@plane/types";
import type { IWorkspaceDraftIssues } from "./issue.store";
import { WorkspaceDraftIssuesFilter } from "./filter.store";

const setup = async () => {
  const fetchIssues = vi.fn<IWorkspaceDraftIssues["fetchIssues"]>().mockResolvedValue(undefined);
  const store = new WorkspaceDraftIssuesFilter({ workspaceSlug: "ws", workspaceDraftIssues: { fetchIssues } });
  await store.fetchFilters("ws");
  return { store, fetchIssues };
};

const stored = (store: WorkspaceDraftIssuesFilter, key: EIssuesStoreType, viewId?: string) =>
  store.handleIssuesLocalFilters.get(key, "ws", viewId, undefined);

afterEach(() => {
  localStorage.clear();
});

describe("WorkspaceDraftIssuesFilter", () => {
  it("stores display filters under the drafts key and refetches the drafts", async () => {
    const { store, fetchIssues } = await setup();

    await store.updateFilters("ws", EIssueFilterType.DISPLAY_FILTERS, { order_by: "-priority" });

    expect(stored(store, EIssuesStoreType.WORKSPACE_DRAFT)?.display_filters?.order_by).toBe("-priority");
    expect(stored(store, EIssuesStoreType.PROFILE, "ws")).toBeUndefined();
    expect(fetchIssues).toHaveBeenCalledWith("ws", "mutation", EDraftIssuePaginationType.CURRENT);
  });

  it("stores rich filters under the drafts key and refetches the drafts", async () => {
    const { store, fetchIssues } = await setup();

    await store.updateFilterExpression("ws", "u1", { state_id__in: "s1" });

    expect(stored(store, EIssuesStoreType.WORKSPACE_DRAFT)?.rich_filters).toEqual({ state_id__in: "s1" });
    expect(stored(store, EIssuesStoreType.PROFILE, "ws")).toBeUndefined();
    expect(fetchIssues).toHaveBeenCalledWith("ws", "mutation", EDraftIssuePaginationType.CURRENT);
  });

  it("restores stored display properties without refetching", async () => {
    const { store, fetchIssues } = await setup();
    await store.updateFilters("ws", EIssueFilterType.DISPLAY_PROPERTIES, { labels: false });

    const { store: restored } = await setup();

    expect(restored.getIssueFilters("ws")?.displayProperties?.labels).toBe(false);
    expect(fetchIssues).not.toHaveBeenCalled();
  });
});
