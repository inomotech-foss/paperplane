// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useState } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { observer } from "mobx-react";
import { createMemoryRouter, RouterProvider, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EIssueFilterType, ISSUE_DISPLAY_PROPERTIES_KEYS } from "@plane/constants";
import type { TSupportedFilterTypeForUpdate } from "@plane/constants";
import { WorkItemFilterStore } from "@plane/shared-state";
import type { IProjectUserPropertiesResponse, TSupportedFilterForUpdate } from "@plane/types";
import { EIssueLayoutTypes, EIssuesStoreType, EStartOfTheWeek } from "@plane/types";
import { useProjectViewUrlAdapter } from "@/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/issues/(list)/view-url";
import { CalendarOptionsDropdown } from "@/components/issues/issue-layouts/calendar/dropdowns/options-dropdown";
import { FilterDisplayProperties } from "@/components/issues/issue-layouts/filters/header/display-filters/display-properties";
import { HeaderColumn } from "@/components/issues/issue-layouts/spreadsheet/columns/header-column";
import { useAppliedFilters } from "@/components/work-item-query/use-applied-filters";
import { WorkItemQueryService } from "@/services/issue";
import { ProjectIssuesFilter } from "@/store/issue/project/filter.store";
import { getWorkItemPage } from "./pages";
import { useWorkItemViewUrl, WorkItemViewUrlProvider } from "./provider";
import { parseViewRequest, shouldRevalidateView } from "./route";

const mocks = vi.hoisted(() => {
  const state: { issuesFilter?: unknown; filters?: unknown } = {};
  return {
    ...state,
    issues: { clear: () => {}, fetchIssuesWithExistingPagination: () => Promise.resolve(undefined) },
  };
});

vi.mock("@/hooks/store/use-issues", () => ({
  useIssues: () => ({ issues: mocks.issues, issuesFilter: mocks.issuesFilter }),
}));
vi.mock("@/hooks/store/work-item-filters/use-work-item-filters", () => ({ useWorkItemFilters: () => mocks.filters }));
vi.mock("@/hooks/store/use-calendar-view", () => ({
  useCalendarView: () => ({
    calendarFilters: { activeMonthDate: new Date(), activeWeekDate: new Date() },
    updateCalendarPayload: () => {},
  }),
}));
vi.mock("@/hooks/store/use-issue-custom-properties", () => ({
  useIssueCustomProperties: () => ({ getActiveProjectProperties: () => [], getPropertyById: () => undefined }),
}));

const page = getWorkItemPage(EIssuesStoreType.PROJECT);

const loader = ({ request }: LoaderFunctionArgs) => ({ view: parseViewRequest(request, page) });

const SAVED: IProjectUserPropertiesResponse = {
  rich_filters: {},
  display_filters: {
    layout: EIssueLayoutTypes.KANBAN,
    group_by: "priority",
    order_by: "-priority",
    calendar: { layout: "month", show_weekends: false },
  },
  display_properties: Object.fromEntries(ISSUE_DISPLAY_PROPERTIES_KEYS.map((key) => [key, true])),
  sort_order: 0,
  preferences: { pages: { block_display: false }, navigation: { default_tab: "", hide_in_more_menu: [] } },
};

const setup = (link: string) => {
  const store = new ProjectIssuesFilter({
    projectId: "p1",
    currentUserId: "u1",
    projectIssues: mocks.issues,
    rootStore: {
      memberRoot: { project: { getProjectUserProperties: () => null, fetchProjectUserProperties: async () => SAVED } },
    },
  });
  const update = vi.spyOn(store.projectService, "updateProjectUserProperties").mockResolvedValue(SAVED);
  const filterStore = new WorkItemFilterStore();
  mocks.issuesFilter = store;
  mocks.filters = filterStore;
  vi.spyOn(WorkItemQueryService.prototype, "validate").mockResolvedValue({ valid: true });
  // the bindings of useIssuesActions
  const updateFilters = (projectId: string, type: TSupportedFilterTypeForUpdate, filters: TSupportedFilterForUpdate) =>
    store.updateFilters("ws", projectId, type, filters);

  const Writers = observer(function Writers() {
    const shown = store.getIssueFilters("p1");
    const [filter] = useState(() =>
      filterStore.getOrCreateFilter({
        entityType: EIssuesStoreType.PROJECT,
        entityId: "p1",
        initialExpression: shown?.richFilters,
        onExpressionChange: (expression) => void store.updateFilterExpression("ws", "p1", expression),
      })
    );
    const { clearAll } = useAppliedFilters(EIssuesStoreType.PROJECT, "p1", filter);
    if (!shown?.displayFilters || !shown.displayProperties) return null;
    return (
      <>
        <CalendarOptionsDropdown issuesFilterStore={store} updateFilters={updateFilters} />
        <FilterDisplayProperties
          displayProperties={shown.displayProperties}
          displayPropertiesToRender={["labels", "key"]}
          handleUpdate={(property) => void updateFilters("p1", EIssueFilterType.DISPLAY_PROPERTIES, property)}
        />
        <HeaderColumn
          property="priority"
          displayFilters={shown.displayFilters}
          handleDisplayFilterUpdate={(filters) => void updateFilters("p1", EIssueFilterType.DISPLAY_FILTERS, filters)}
          onClose={() => {}}
        />
        <button type="button" onClick={() => void clearAll()}>
          clear all
        </button>
      </>
    );
  });

  const Gate = observer(function Gate() {
    return useWorkItemViewUrl()?.ready ? <Writers /> : null;
  });

  function Layout() {
    const { view } = useLoaderData<typeof loader>();
    const adapter = useProjectViewUrlAdapter("ws", "p1");
    return (
      <WorkItemViewUrlProvider adapter={adapter} parsed={view} weekStart={EStartOfTheWeek.SUNDAY}>
        <Gate />
      </WorkItemViewUrlProvider>
    );
  }

  const router = createMemoryRouter(
    [
      {
        path: "/:workspaceSlug/projects/:projectId/issues",
        loader,
        shouldRevalidate: shouldRevalidateView,
        Component: Layout,
      },
    ],
    { initialEntries: [`/ws/projects/p1/issues?${link}`] }
  );
  render(<RouterProvider router={router} />);
  const search = () => router.state.location.search;
  return { store, update, filterStore, search };
};

const openMenu = async (trigger: HTMLElement) => {
  fireEvent.click(trigger);
  await screen.findByRole("menu");
};

beforeAll(() => {
  // the menus measure themselves
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.getAnimations = () => [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("UI changes after opening a link", () => {
  it("saves only the toggled calendar option", async () => {
    const { store, update, search } = setup("l=calendar&cal=week");
    await waitFor(() => expect(search()).toBe("?l=calendar&cal=week"));

    await openMenu(await screen.findByRole("button", { name: "Options" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox"));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][2].display_filters?.calendar).toEqual({ layout: "month", show_weekends: true });
    expect(update.mock.calls[0][2].display_filters?.layout).toBe(EIssueLayoutTypes.KANBAN);
    expect(store.getIssueFilters("p1")?.displayFilters?.calendar).toEqual({ layout: "week", show_weekends: true });
    expect(search()).toBe("?l=calendar&cal=week");
  });

  it("saves only the picked calendar layout", async () => {
    const { update, search } = setup("l=calendar");
    await waitFor(() => expect(search()).toBe("?l=calendar"));

    await openMenu(await screen.findByRole("button", { name: "Options" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Week layout" }));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][2].display_filters?.calendar).toEqual({ layout: "week", show_weekends: false });
    expect(update.mock.calls[0][2].display_filters?.layout).toBe(EIssueLayoutTypes.KANBAN);
    await waitFor(() => expect(search()).toBe("?l=calendar&cal=week"));
  });

  it("saves only the toggled display property", async () => {
    const { update, search } = setup("l=list&p=-key");
    await waitFor(() => expect(search()).toBe("?l=list&p=-key"));

    fireEvent.click(await screen.findByRole("button", { name: "Labels" }));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][2].display_properties).toEqual({ ...SAVED.display_properties, labels: false });
    await waitFor(() => expect(search()).toBe("?l=list&p=-key,-labels"));
  });

  it("saves only the order picked in a table header", async () => {
    const { update, search } = setup("l=table&o=-created_at");
    await waitFor(() => expect(search()).toBe("?l=table&o=-created_at"));

    await openMenu(await screen.findByRole("button", { name: /Priority/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /^None/ }));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const persisted = update.mock.calls[0][2].display_filters;
    expect(persisted?.order_by).toBe("priority");
    expect(persisted?.layout).toBe(EIssueLayoutTypes.KANBAN);
    await waitFor(() => expect(search()).toBe("?l=table&o=priority"));
  });

  it("clears the link's filters and query without saving its other keys", async () => {
    const { update, search } = setup("l=list&f=priority:in:urgent&q=priority+%3D+high");
    await waitFor(() => expect(search()).toBe("?l=list&f=priority:in:urgent&q=priority+%3D+high"));

    fireEvent.click(await screen.findByRole("button", { name: "clear all" }));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update).toHaveBeenCalledWith("ws", "p1", { rich_filters: {} });
    const displayFilters = update.mock.calls.find(([, , data]) => data.display_filters)?.[2].display_filters;
    expect(displayFilters).toMatchObject({ ...SAVED.display_filters, pql: "" });
    await waitFor(() => expect(search()).toBe("?l=list"));
  });
});

describe("project view URL adapter", () => {
  it("resets a filter bar quietly only when asked", () => {
    const onExpressionChange = vi.fn();
    const filter = new WorkItemFilterStore().getOrCreateFilter({
      entityType: EIssuesStoreType.PROJECT,
      entityId: "p1",
      onExpressionChange,
    });

    filter.resetExpression({ priority__in: "high" }, { notify: false });
    expect(onExpressionChange).not.toHaveBeenCalled();
    filter.resetExpression({ priority__in: "low" });
    expect(onExpressionChange).toHaveBeenCalledTimes(1);
  });

  it("mirrors rich filters into the filter bar without saving them", async () => {
    const { store, update, filterStore } = setup("l=list");
    await screen.findByRole("button", { name: "clear all" });
    const onExpressionChange = vi.fn();
    const filter = filterStore.getOrCreateFilter({
      entityType: EIssuesStoreType.PROJECT,
      entityId: "p1",
      onExpressionChange,
    });
    const { result } = renderHook(() => useProjectViewUrlAdapter("ws", "p1"));

    act(() => result.current.effects.setRichFilters({ priority__in: "urgent" }));

    expect(filter.hasActiveFilters).toBe(true);
    expect(filter.hasChanges).toBe(false);
    expect(onExpressionChange).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(store.savedFilters.p1.richFilters).toEqual({});
  });
});
