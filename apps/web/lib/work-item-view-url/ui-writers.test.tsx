// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { observer } from "mobx-react";
import { createMemoryRouter, RouterProvider, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EIssueFilterType, ISSUE_DISPLAY_PROPERTIES_KEYS } from "@plane/constants";
import type { TSupportedFilterTypeForUpdate } from "@plane/constants";
import { WorkItemFilterStore } from "@plane/shared-state";
import type { IWorkItemFilterInstance } from "@plane/shared-state";
import type { IProjectUserPropertiesResponse, TSupportedFilterForUpdate } from "@plane/types";
import { COLLECTION_OPERATOR, EIssueLayoutTypes, EIssuesStoreType, LOGICAL_OPERATOR } from "@plane/types";
import {
  loadProjectWorkItemsView,
  useProjectWorkItemsViewRoute,
} from "@/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/issues/(list)/view-url";
import { CalendarOptionsDropdown } from "@/components/issues/issue-layouts/calendar/dropdowns/options-dropdown";
import { FilterDisplayProperties } from "@/components/issues/issue-layouts/filters/header/display-filters/display-properties";
import { HeaderColumn } from "@/components/issues/issue-layouts/spreadsheet/columns/header-column";
import { WorkItemFiltersHOC } from "@/components/work-item-filters/filters-hoc/base";
import { useAppliedFilters } from "@/components/work-item-query/use-applied-filters";
import { WorkItemQueryService } from "@/services/issue";
import { ProjectIssuesFilter } from "@/store/issue/project/filter.store";
import { shouldRevalidateView } from "./route";

const mocks = vi.hoisted(() => ({
  root: {},
  issuesFilter: {},
  filters: {},
  issues: { clear: () => {}, fetchIssuesWithExistingPagination: () => Promise.resolve(undefined) },
}));

vi.mock("@/lib/store-context", () => ({
  get store() {
    return mocks.root;
  },
}));
vi.mock("@/hooks/store/use-issues", () => ({
  useIssues: () => ({ issues: mocks.issues, issuesFilter: mocks.issuesFilter }),
}));
vi.mock("@/hooks/store/work-item-filters/use-work-item-filters", () => ({ useWorkItemFilters: () => mocks.filters }));
vi.mock("@/hooks/work-item-filters/use-work-item-filters-config", () => ({
  useWorkItemFiltersConfig: () => ({ areAllConfigsInitialized: true, configs: [] }),
}));
vi.mock("@/hooks/store/use-calendar-view", () => ({
  useCalendarView: () => ({
    calendarFilters: { activeMonthDate: new Date(), activeWeekDate: new Date() },
    updateCalendarPayload: () => {},
  }),
}));
vi.mock("@/hooks/store/use-issue-custom-properties", () => ({
  useIssueCustomProperties: () => ({ getActiveProjectProperties: () => [], getPropertyById: () => undefined }),
}));

const loader = ({ request }: LoaderFunctionArgs) => loadProjectWorkItemsView(request, "ws", "p1");

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
    workspaceSlug: "ws",
    currentUserId: "u1",
    projectIssues: mocks.issues,
    rootStore: {
      memberRoot: { project: { getProjectUserProperties: () => null, fetchProjectUserProperties: async () => SAVED } },
      user: { data: { id: "u1" } },
    },
  });
  const update = vi.spyOn(store.projectService, "updateProjectUserProperties").mockResolvedValue(SAVED);
  const filterStore = new WorkItemFilterStore();
  mocks.issuesFilter = store;
  mocks.filters = filterStore;
  mocks.root = {
    issue: { projectIssuesFilter: store, projectIssues: mocks.issues },
    workItemFilters: filterStore,
    user: { userProfile: { data: undefined } },
  };
  vi.spyOn(WorkItemQueryService.prototype, "validate").mockResolvedValue({ valid: true });
  // the bindings of useIssuesActions
  const updateFilters = (projectId: string, type: TSupportedFilterTypeForUpdate, filters: TSupportedFilterForUpdate) =>
    store.updateFilters("ws", projectId, type, filters);
  let richFilter: IWorkItemFilterInstance | undefined;

  const Writers = observer(function Writers({ filter }: { filter: IWorkItemFilterInstance }) {
    const shown = store.getIssueFilters("p1");
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

  // the filter bar of ProjectLayoutRoot, with its instance created in a layout effect
  const Page = observer(function Page() {
    const shown = store.getIssueFilters("p1");
    if (!shown) return null;
    return (
      <WorkItemFiltersHOC
        entityType={EIssuesStoreType.PROJECT}
        entityId="p1"
        filtersToShowByLayout={[]}
        initialWorkItemFilters={shown}
        updateFilters={(expression) => store.updateFilterExpression("ws", "p1", expression)}
        workspaceSlug="ws"
      >
        {({ filter }) => {
          richFilter = filter;
          return filter ? <Writers filter={filter} /> : null;
        }}
      </WorkItemFiltersHOC>
    );
  });

  function Layout() {
    useProjectWorkItemsViewRoute(useLoaderData<typeof loader>(), "p1");
    return <Page />;
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
  const getRichFilter = () => {
    if (!richFilter) throw new Error("the filter bar is not shown");
    return richFilter;
  };
  return { router, store, update, search, getRichFilter };
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
    await openMenu(await screen.findByRole("button", { name: "Options" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox"));

    await waitFor(() => expect(store.getIssueFilters("p1")?.displayFilters?.calendar?.show_weekends).toBe(true));
    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0][2].display_filters?.calendar).toEqual({ layout: "month", show_weekends: true });
    expect(update.mock.calls[0][2].display_filters?.layout).toBe(EIssueLayoutTypes.KANBAN);
    expect(store.getIssueFilters("p1")?.displayFilters?.calendar?.layout).toBe("week");
    expect(search()).toBe("?l=calendar&cal=week");
  });

  it("saves only the picked calendar layout", async () => {
    const { update, search } = setup("l=calendar");
    await openMenu(await screen.findByRole("button", { name: "Options" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Week layout" }));

    await waitFor(() => expect(search()).toBe("?l=calendar&cal=week"));
    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0][2].display_filters?.calendar).toEqual({ layout: "week", show_weekends: false });
    expect(update.mock.calls[0][2].display_filters?.layout).toBe(EIssueLayoutTypes.KANBAN);
  });

  it("saves only the toggled display property", async () => {
    const { update, search } = setup("l=list&p=-key");
    fireEvent.click(await screen.findByRole("button", { name: "Labels" }));

    await waitFor(() => expect(search()).toBe("?l=list&p=-key,-labels"));
    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0][2].display_properties).toEqual({ ...SAVED.display_properties, labels: false });
  });

  it("saves only the order picked in a table header", async () => {
    const { update, search } = setup("l=table&o=-created_at");
    await openMenu(await screen.findByRole("button", { name: /Priority/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /^None/ }));

    await waitFor(() => expect(search()).toBe("?l=table&o=priority"));
    expect(update).toHaveBeenCalledOnce();
    const persisted = update.mock.calls[0][2].display_filters;
    expect(persisted?.order_by).toBe("priority");
    expect(persisted?.layout).toBe(EIssueLayoutTypes.KANBAN);
  });

  it("clears the link's filters and query without saving its other keys", async () => {
    const { update, search } = setup("l=list&f=priority:in:urgent&q=priority+%3D+high");
    fireEvent.click(await screen.findByRole("button", { name: "clear all" }));

    await waitFor(() => expect(search()).toBe("?l=list"));
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith("ws", "p1", { rich_filters: {} });
    const displayFilters = update.mock.calls.find(([, , data]) => data.display_filters)?.[2].display_filters;
    expect(displayFilters).toMatchObject({ ...SAVED.display_filters, pql: "" });
  });

  it("adds a rich filter condition through the filter bar", async () => {
    const { store, update, search, getRichFilter } = setup("l=list&o=-created_at");
    await screen.findByRole("button", { name: "clear all" });
    const filter = getRichFilter();

    act(() =>
      filter.addCondition(
        LOGICAL_OPERATOR.AND,
        { property: "priority", operator: COLLECTION_OPERATOR.IN, value: undefined },
        false
      )
    );
    const [condition] = filter.allConditions;
    // a condition without a value changes nothing yet
    expect(update).not.toHaveBeenCalled();

    act(() => filter.updateConditionValue(condition.id, ["urgent"]));
    await waitFor(() => expect(search()).toBe("?l=list&o=-created_at&f=priority:in:urgent"));
    act(() => filter.updateConditionValue(condition.id, ["urgent", "high"]));
    await waitFor(() => expect(search()).toBe("?l=list&o=-created_at&f=priority:in:urgent,high"));

    expect(store.getIssueFilters("p1")?.richFilters).toEqual({ priority__in: "urgent,high" });
    // the bar keeps its own condition while the URL catches up
    expect(filter.allConditions.map(({ id }) => id)).toEqual([condition.id]);
    expect(update).toHaveBeenLastCalledWith("ws", "p1", { rich_filters: { priority__in: "urgent,high" } });
    expect(store.savedFilters.p1.displayFilters?.order_by).toBe("-priority");
  });

  it("mirrors the URL's rich filters into the filter bar without saving them", async () => {
    const { router, update, getRichFilter } = setup("l=list&f=priority:in:urgent");
    await screen.findByRole("button", { name: "clear all" });
    expect(getRichFilter().allConditions.map(({ value }) => value)).toEqual(["urgent"]);

    // e.g. back to an entry with other filters
    await act(() => router.navigate("/ws/projects/p1/issues?l=list&f=priority:in:high"));
    await waitFor(() => expect(getRichFilter().allConditions.map(({ value }) => value)).toEqual(["high"]));
    expect(update).not.toHaveBeenCalled();
  });
});
