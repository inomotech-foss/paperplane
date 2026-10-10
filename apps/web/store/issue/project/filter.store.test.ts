// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { runInAction, toJS } from "mobx";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EIssueFilterType } from "@plane/constants";
import type { IProjectUserPropertiesResponse } from "@plane/types";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
import { applyViewState, resolveViewState, toViewState } from "@/lib/work-item-view-url/apply";
import type { TViewIntent } from "@/lib/work-item-view-url/intent";
import { getPageBaseline, getWorkItemPage } from "@/lib/work-item-view-url/pages";
import { registerViewRoute } from "@/lib/work-item-view-url/registry";
import type { TViewRoute } from "@/lib/work-item-view-url/registry";
import { parseSearch } from "@/lib/work-item-view-url/serialize";
import { store as rootStore } from "@/lib/store-context";
import { ProjectService } from "@/services/project";
import type { IProjectMemberStore } from "@/store/member/project/base-project-member.store";
import { ProjectIssuesFilter } from "./filter.store";

const page = getWorkItemPage(EIssuesStoreType.PROJECT);

const userProperties: IProjectUserPropertiesResponse = {
  rich_filters: { state_id__in: "s1" },
  display_filters: {
    layout: EIssueLayoutTypes.KANBAN,
    group_by: "priority",
    order_by: "-priority",
    calendar: { layout: "month", show_weekends: false },
  },
  display_properties: { labels: false },
  sort_order: 0,
  preferences: { pages: { block_display: false }, navigation: { default_tab: "", hide_in_more_menu: [] } },
};

const cleanups: (() => void)[] = [];

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
});

/** Mounts a route for the project, as the work items layout does. */
const showRoute = (projectId: string, route: TViewRoute) => {
  cleanups.push(registerViewRoute(page, projectId, route));
};

const createStore = (members?: Pick<IProjectMemberStore, "fetchProjectUserProperties">) => {
  const projectIssues = { clear: vi.fn(), fetchIssuesWithExistingPagination: vi.fn(async () => undefined) };
  const fetchProjectUserProperties = vi.fn(async () => userProperties);
  const store = new ProjectIssuesFilter({
    projectId: "p1",
    workspaceSlug: "ws",
    currentUserId: "u1",
    projectIssues,
    rootStore: { memberRoot: { project: members ?? { fetchProjectUserProperties } }, user: { data: { id: "u1" } } },
  });
  const update = vi.spyOn(store.projectService, "updateProjectUserProperties").mockResolvedValue(userProperties);
  return { store, update, projectIssues, fetchProjectUserProperties };
};

/** Shows the state a link asks for, the way the route's loader does. */
const showLink = (store: ProjectIssuesFilter, search: string, saved = getPageBaseline(page)) => {
  const { state } = resolveViewState(
    parseSearch(new URLSearchParams(search), page),
    page,
    getPageBaseline(page),
    saved
  );
  applyViewState(store, "p1", state);
};

/** A link opened on a page whose route takes the UI changes. */
const openLink = async (search: string) => {
  const context = createStore();
  const saved = await context.store.fetchSavedFilters("ws", "p1");
  showLink(context.store, search, toViewState(saved));
  const intents: TViewIntent[] = [];
  const onIntent = vi.fn(async (intent: TViewIntent) => {
    intents.push(intent);
  });
  showRoute("p1", { onIntent });
  return { ...context, saved, intents, onIntent };
};

describe("ProjectIssuesFilter saved preferences", () => {
  it("loads the preferences without showing them", async () => {
    const { store } = createStore();
    const saved = await store.fetchSavedFilters("ws", "p1");
    expect(saved.displayFilters?.layout).toBe(EIssueLayoutTypes.KANBAN);
    expect(store.savedFilters.p1).toBe(saved);
    expect(store.filters.p1).toBeUndefined();
  });

  it("hands a change to the route and saves only the changed key", async () => {
    const { store, update, saved, intents } = await openLink("l=list&o=-created_at");
    const shown = toJS(store.filters.p1);
    await store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { show_empty_groups: true });

    expect(intents).toEqual([{ type: "displayFilters", changes: { show_empty_groups: true } }]);
    const persisted = update.mock.calls[0][2].display_filters;
    expect(persisted).toEqual({ ...saved.displayFilters, show_empty_groups: true });
    expect(persisted?.layout).toBe(EIssueLayoutTypes.KANBAN);
    // only the route changes the screen
    expect(store.filters.p1).toEqual(shown);
  });

  it("updates the saved preferences before the route shows the change", async () => {
    const { store, onIntent } = await openLink("l=calendar&cal=week");
    onIntent.mockImplementation(async () => {
      expect(store.savedFilters.p1.displayFilters?.calendar?.layout).toBe("month");
      expect(store.savedFilters.p1.displayFilters?.order_by).toBe("priority");
    });
    await store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { order_by: "priority" });
    expect(onIntent).toHaveBeenCalledOnce();
  });

  it("shows a setting the URL does not hold in place, without the route", async () => {
    const { store, update, onIntent, projectIssues } = await openLink("l=calendar&cal=week");
    await store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { calendar: { show_weekends: true } });

    expect(onIntent).not.toHaveBeenCalled();
    expect(store.getIssueFilters("p1")?.displayFilters?.calendar).toEqual({ layout: "week", show_weekends: true });
    expect(update.mock.calls[0][2]).toEqual({
      display_filters: expect.objectContaining({ calendar: { layout: "month", show_weekends: true } }),
    });
    expect(projectIssues.fetchIssuesWithExistingPagination).not.toHaveBeenCalled();
  });

  it("saves only the changed calendar option", async () => {
    const { store, update } = await openLink("l=calendar&cal=week");
    await store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { calendar: { show_weekends: true } });

    const persisted = update.mock.calls[0][2].display_filters;
    expect(persisted?.calendar).toEqual({ layout: "month", show_weekends: true });
    expect(persisted?.layout).toBe(EIssueLayoutTypes.KANBAN);
  });

  it("normalizes the saved preferences, not the shown ones", async () => {
    const { store, update } = await openLink("l=list&g=labels");
    await store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { order_by: "priority" });

    const persisted = update.mock.calls[0][2].display_filters;
    expect(persisted?.layout).toBe(EIssueLayoutTypes.KANBAN);
    expect(persisted?.group_by).toBe("priority");
    expect(persisted?.order_by).toBe("priority");
  });

  it("saves only the changed display property", async () => {
    const { store, update, saved, intents } = await openLink("l=list&p=-key");
    await store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_PROPERTIES, { estimate: false });

    expect(intents).toEqual([{ type: "displayProperties", changes: { estimate: false } }]);
    const persisted = update.mock.calls[0][2].display_properties;
    expect(persisted).toEqual({ ...saved.displayProperties, estimate: false });
    expect(persisted?.key).toBe(true);
  });

  it("saves changed rich filters as a whole", async () => {
    const { store, update, intents } = await openLink("l=list&o=-created_at");
    await store.updateFilterExpression("ws", "p1", { priority__in: "high" });

    expect(intents).toEqual([{ type: "richFilters", expression: { priority__in: "high" } }]);
    expect(update).toHaveBeenCalledWith("ws", "p1", { rich_filters: { priority__in: "high" } });
    expect(store.savedFilters.p1.displayFilters?.order_by).toBe("-priority");
  });

  it("loads the saved preferences before saving a change", async () => {
    const { store, update, fetchProjectUserProperties } = createStore();
    showLink(store, "l=list&o=-created_at");
    showRoute("p1", { onIntent: async () => {} });
    await store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { show_empty_groups: true });

    expect(fetchProjectUserProperties).toHaveBeenCalledTimes(1);
    const persisted = update.mock.calls[0][2].display_filters;
    expect(persisted?.order_by).toBe("-priority");
    expect(persisted?.show_empty_groups).toBe(true);
  });

  it("shows but does not save a change when the saved preferences cannot be loaded", async () => {
    const { store, update, fetchProjectUserProperties } = createStore();
    fetchProjectUserProperties.mockRejectedValueOnce(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    showLink(store, "l=list&o=-created_at");
    const onIntent = vi.fn(async () => {});
    showRoute("p1", { onIntent });
    await store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_PROPERTIES, { estimate: false });

    expect(update).not.toHaveBeenCalled();
    expect(onIntent).toHaveBeenCalledOnce();
  });

  it("reloads only the saved preferences when saving fails", async () => {
    const { store, update, onIntent } = await openLink("l=list");
    update.mockRejectedValueOnce(new Error("offline"));
    await expect(
      store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { order_by: "priority" })
    ).rejects.toThrow("offline");

    expect(onIntent).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(store.savedFilters.p1.displayFilters?.order_by).toBe("-priority"));
  });

  it("shows a change in place for a project no route shows", async () => {
    const { store, projectIssues } = createStore();
    showLink(store, "l=list");
    showRoute("p2", { onIntent: async () => {} });
    await store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { order_by: "priority" });

    expect(store.getIssueFilters("p1")?.displayFilters?.order_by).toBe("priority");
    expect(projectIssues.fetchIssuesWithExistingPagination).toHaveBeenCalledOnce();
  });
});

describe("ProjectIssuesFilter collapsed groups", () => {
  it("reads them from local storage and keeps them out of the route", async () => {
    const { store } = await openLink("l=kanban");
    await store.updateFilters("ws", "p1", EIssueFilterType.KANBAN_FILTERS, { group_by: ["urgent"] });
    expect(store.getIssueFilters("p1")?.kanbanFilters?.group_by).toEqual(["urgent"]);

    const other = createStore().store;
    showLink(other, "l=kanban");
    expect(other.getIssueFilters("p1")?.kanbanFilters?.group_by).toEqual(["urgent"]);
  });
});

const preferences = (default_tab: string) => ({
  pages: { block_display: false },
  navigation: { default_tab, hide_in_more_menu: [] },
});

const createMembers = () => {
  const members = rootStore.memberRoot.project;
  runInAction(() => {
    members.projectUserPropertiesMap = {};
  });
  const get = vi.spyOn(ProjectService.prototype, "getProjectUserProperties").mockResolvedValue(userProperties);
  vi.spyOn(ProjectService.prototype, "updateProjectUserProperties").mockImplementation(async (_, __, data) => ({
    ...userProperties,
    ...data,
  }));
  return { members, get };
};

describe("ProjectIssuesFilter with the member store", () => {
  it("keeps the display settings in the member store when a tab preference changes", async () => {
    const { members } = createMembers();
    await members.fetchProjectUserProperties("ws", "p1");
    await members.updateProjectUserProperties("ws", "p1", { preferences: preferences("pages") });

    const properties = members.getProjectUserProperties("p1");
    expect(properties?.display_filters).toEqual(userProperties.display_filters);
    expect(properties?.preferences.navigation.default_tab).toBe("pages");
  });

  it("loads the saved preferences from the server, not the member store", async () => {
    const { members, get } = createMembers();
    await members.fetchProjectUserProperties("ws", "p1");
    // another writer left only part of the response in the member store
    runInAction(() => {
      members.projectUserPropertiesMap.p1 = { ...userProperties, display_filters: {}, display_properties: {} };
    });
    const { store, update } = createStore(members);

    const saved = await store.loadSavedFilters("ws", "p1");
    expect(get).toHaveBeenCalledTimes(2);
    expect(saved.displayFilters?.layout).toBe(EIssueLayoutTypes.KANBAN);

    showLink(store, "l=list");
    showRoute("p1", { onIntent: async () => {} });
    await store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { show_empty_groups: true });
    expect(update.mock.calls[0][2].display_filters).toEqual(
      expect.objectContaining({ layout: EIssueLayoutTypes.KANBAN, group_by: "priority", show_empty_groups: true })
    );
  });
});

describe("ProjectIssuesFilter unchanged values", () => {
  it("does not save a change the saved preferences already hold", async () => {
    const { store, update, intents } = await openLink("l=list&o=-created_at");
    await store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { order_by: "-priority" });
    await store.updateFilterExpression("ws", "p1", { state_id__in: "s1" });

    expect(update).not.toHaveBeenCalled();
    // the screen still follows the change
    expect(intents).toHaveLength(2);
  });
});
