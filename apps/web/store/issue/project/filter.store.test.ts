// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import { EIssueFilterType } from "@plane/constants";
import type { IProjectUserPropertiesResponse } from "@plane/types";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
import { applyViewState, resolveViewState, toViewState } from "@/lib/work-item-view-url/apply";
import { getPageBaseline, getWorkItemPage } from "@/lib/work-item-view-url/pages";
import { parseSearch } from "@/lib/work-item-view-url/serialize";
import { ProjectIssuesFilter } from "./filter.store";

const page = getWorkItemPage(EIssuesStoreType.PROJECT);

const userProperties: IProjectUserPropertiesResponse = {
  rich_filters: { state_id__in: "s1" },
  display_filters: { layout: EIssueLayoutTypes.KANBAN, group_by: "priority", order_by: "-priority" },
  display_properties: { labels: false },
  sort_order: 0,
  preferences: { pages: { block_display: false }, navigation: { default_tab: "", hide_in_more_menu: [] } },
};

const setup = async () => {
  const projectIssues = { clear: vi.fn(), fetchIssuesWithExistingPagination: vi.fn() };
  const store = new ProjectIssuesFilter({ projectId: "p1", currentUserId: "u1", projectIssues });
  vi.spyOn(store.projectService, "getProjectUserProperties").mockResolvedValue(userProperties);
  const update = vi.spyOn(store.projectService, "updateProjectUserProperties").mockResolvedValue(userProperties);
  const saved = await store.fetchSavedFilters("ws", "p1");
  return { store, saved, update, projectIssues };
};

/** Shows the state a link asks for, the way the route does. */
const openLink = async (search: string) => {
  const context = await setup();
  const { state } = resolveViewState(
    parseSearch(new URLSearchParams(search), page),
    page,
    getPageBaseline(page),
    toViewState(context.saved)
  );
  applyViewState(context.store, "p1", state, context.saved.kanbanFilters);
  return context;
};

describe("ProjectIssuesFilter saved preferences", () => {
  it("loads the preferences without showing them", async () => {
    const { store, saved } = await setup();
    expect(saved.displayFilters?.layout).toBe(EIssueLayoutTypes.KANBAN);
    expect(store.savedFilters.p1).toBe(saved);
    expect(store.filters.p1).toBeUndefined();
  });

  it("does not save a view opened from a link", async () => {
    const { store, update } = await openLink("l=list&o=-created_at&f=priority:in:urgent&p=-key");
    expect(store.getIssueFilters("p1")?.displayFilters?.layout).toBe(EIssueLayoutTypes.LIST);
    expect(update).not.toHaveBeenCalled();
  });

  it("saves only the changed display filter", async () => {
    const { store, update, saved } = await openLink("l=list&o=-created_at");
    await store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { sub_issue: false });

    const persisted = update.mock.calls[0][2].display_filters;
    expect(persisted).toEqual({ ...saved.displayFilters, sub_issue: false });
    expect(persisted?.layout).toBe(EIssueLayoutTypes.KANBAN);
    expect(persisted?.order_by).toBe("-priority");
    // the screen keeps the link's view
    expect(store.getIssueFilters("p1")?.displayFilters?.order_by).toBe("-created_at");
    expect(store.savedFilters.p1.displayFilters).toEqual(persisted);
  });

  it("normalizes the saved preferences, not the shown ones", async () => {
    const { store, update } = await openLink("l=list&g=labels");
    await store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { layout: EIssueLayoutTypes.KANBAN });

    const persisted = update.mock.calls[0][2].display_filters;
    expect(persisted?.layout).toBe(EIssueLayoutTypes.KANBAN);
    expect(persisted?.group_by).toBe("priority");
  });

  it("saves only the changed display property", async () => {
    const { store, update, saved } = await openLink("l=list&p=-key");
    await store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_PROPERTIES, { estimate: false });

    const persisted = update.mock.calls[0][2].display_properties;
    expect(persisted).toEqual({ ...saved.displayProperties, estimate: false });
    expect(persisted?.key).toBe(true);
    expect(store.getIssueFilters("p1")?.displayProperties?.key).toBe(false);
  });

  it("saves changed rich filters as a whole", async () => {
    const { store, update } = await openLink("l=list&o=-created_at");
    await store.updateFilterExpression("ws", "p1", { priority__in: "high" });

    expect(update).toHaveBeenCalledWith("ws", "p1", { rich_filters: { priority__in: "high" } });
    expect(store.savedFilters.p1.richFilters).toEqual({ priority__in: "high" });
    expect(store.savedFilters.p1.displayFilters?.order_by).toBe("-priority");
  });

  it("keeps the shown filters when saving fails", async () => {
    const { store, update } = await openLink("l=list");
    update.mockRejectedValueOnce(new Error("offline"));
    await expect(
      store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { order_by: "priority" })
    ).rejects.toThrow("offline");

    expect(store.getIssueFilters("p1")?.displayFilters?.order_by).toBe("priority");
    await vi.waitFor(() => expect(store.savedFilters.p1.displayFilters?.order_by).toBe("-priority"));
  });
});
