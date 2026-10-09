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

const createStore = () => {
  const projectIssues = { clear: vi.fn(), fetchIssuesWithExistingPagination: vi.fn() };
  const fetchProjectUserProperties = vi.fn(async () => userProperties);
  const members = { getProjectUserProperties: () => null, fetchProjectUserProperties };
  const store = new ProjectIssuesFilter({
    projectId: "p1",
    currentUserId: "u1",
    projectIssues,
    rootStore: { memberRoot: { project: members } },
  });
  const update = vi.spyOn(store.projectService, "updateProjectUserProperties").mockResolvedValue(userProperties);
  return { store, update, projectIssues, fetchProjectUserProperties };
};

const setup = async () => {
  const context = createStore();
  const saved = await context.store.fetchSavedFilters("ws", "p1");
  return { ...context, saved };
};

/** Shows the state a link asks for, the way the route does. */
const showLink = (store: ProjectIssuesFilter, search: string, saved = getPageBaseline(page)) => {
  const { state } = resolveViewState(
    parseSearch(new URLSearchParams(search), page),
    page,
    getPageBaseline(page),
    saved
  );
  applyViewState(store, "p1", state, undefined);
};

const openLink = async (search: string) => {
  const context = await setup();
  showLink(context.store, search, toViewState(context.saved));
  return context;
};

describe("ProjectIssuesFilter saved preferences", () => {
  it("loads the preferences without showing them", async () => {
    const { store, saved } = await setup();
    expect(saved.displayFilters?.layout).toBe(EIssueLayoutTypes.KANBAN);
    expect(store.savedFilters.p1).toBe(saved);
    expect(store.filters.p1).toBeUndefined();
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

  it("loads the saved preferences before saving a change", async () => {
    const { store, update, fetchProjectUserProperties } = createStore();
    showLink(store, "l=list&o=-created_at");
    await store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { sub_issue: false });

    expect(fetchProjectUserProperties).toHaveBeenCalledTimes(1);
    const persisted = update.mock.calls[0][2].display_filters;
    expect(persisted?.order_by).toBe("-priority");
    expect(persisted?.sub_issue).toBe(false);
  });

  it("shows but does not save a change when the saved preferences cannot be loaded", async () => {
    const { store, update, fetchProjectUserProperties } = createStore();
    fetchProjectUserProperties.mockRejectedValueOnce(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    showLink(store, "l=list&o=-created_at");
    await store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_PROPERTIES, { estimate: false });

    expect(update).not.toHaveBeenCalled();
    expect(store.getIssueFilters("p1")?.displayProperties?.estimate).toBe(false);
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
