// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useCallback, useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { observer } from "mobx-react";
import { createMemoryRouter, RouterProvider, useLoaderData, useParams } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EIssueFilterType } from "@plane/constants";
import type { IProjectUserPropertiesResponse } from "@plane/types";
import { EIssueLayoutTypes, EIssuesStoreType, EStartOfTheWeek } from "@plane/types";
import { ProjectIssuesFilter } from "@/store/issue/project/filter.store";
import { getWorkItemPage } from "./pages";
import { PqlDraftProvider, usePqlDraft } from "./pql-draft";
import { loadViewState, shouldRevalidateView } from "./route";
import { useWorkItemViewRoute } from "./use-view-route";

const page = getWorkItemPage(EIssuesStoreType.PROJECT);
const INVALID = "nope = 1";

const properties = (display_filters: IProjectUserPropertiesResponse["display_filters"]) => ({
  rich_filters: {},
  display_filters,
  display_properties: {},
  sort_order: 0,
  preferences: { pages: { block_display: false }, navigation: { default_tab: "", hide_in_more_menu: [] } },
});

const SAVED: Record<string, IProjectUserPropertiesResponse> = {
  p1: properties({
    layout: EIssueLayoutTypes.KANBAN,
    group_by: "priority",
    calendar: { layout: "month", show_weekends: false },
  }),
  p2: properties({ layout: EIssueLayoutTypes.SPREADSHEET, order_by: "-priority" }),
};

const layout = () => screen.getByTestId("layout").textContent;

const setup = (initialEntry: string, options: { holdValidation?: boolean } = {}) => {
  const fetchProjectUserProperties = vi.fn(async (_: string, projectId: string) => SAVED[projectId]);
  const store = new ProjectIssuesFilter({
    projectId: "p1",
    workspaceSlug: "ws",
    currentUserId: "u1",
    projectIssues: { clear: vi.fn(), fetchIssuesWithExistingPagination: vi.fn() },
    rootStore: {
      memberRoot: { project: { getProjectUserProperties: () => null, fetchProjectUserProperties } },
      user: { data: { id: "u1" } },
    },
  });
  const update = vi
    .spyOn(store.projectService, "updateProjectUserProperties")
    .mockImplementation(async (_, projectId) => SAVED[projectId]);
  const effects = { clear: vi.fn(), refetch: vi.fn(), setRichFilters: vi.fn() };
  /** Layouts that mounted and so fetched their list. */
  const fetches: string[] = [];
  const releases: (() => void)[] = [];
  const validatePql = vi.fn(async (pql: string) => {
    if (options.holdValidation) await new Promise<void>((resolve) => releases.push(resolve));
    return pql === INVALID ? { valid: false, error: "Unknown field" } : { valid: true };
  });

  const loader = ({ request, params }: LoaderFunctionArgs) => {
    const projectId = params.projectId ?? "";
    return loadViewState(request, {
      page,
      entityId: projectId,
      store,
      loadSaved: () => store.loadSavedFilters("ws", projectId),
      validatePql,
      weekStart: EStartOfTheWeek.SUNDAY,
      isShown: () => store.viewRoute?.entityId === projectId,
      effects,
    });
  };

  function LayoutView({ name }: { name: string }) {
    useEffect(() => {
      fetches.push(name);
    }, [name]);
    return <output data-testid="layout">{name}</output>;
  }

  const List = observer(function List() {
    const { projectId = "" } = useParams();
    const draft = usePqlDraft();
    const filters = store.getIssueFilters(projectId);
    if (!filters?.displayFilters) return null;
    const { layout: shownLayout, pql, calendar } = filters.displayFilters;
    return (
      <>
        <LayoutView key={`${projectId}/${shownLayout}`} name={`${projectId}/${shownLayout}`} />
        <output data-testid="pql">{pql ?? ""}</output>
        <output data-testid="weekends">{String(calendar?.show_weekends)}</output>
        {draft && <output data-testid="draft">{`${draft.query}|${draft.error}`}</output>}
      </>
    );
  });

  function Layout() {
    const data = useLoaderData<typeof loader>();
    const { projectId = "" } = useParams();
    const getSaved = useCallback(() => store.savedFilters[projectId], [projectId]);
    const { pqlDraft } = useWorkItemViewRoute(data, {
      page,
      entityId: projectId,
      setRoute: store.setViewRoute,
      getSaved,
      weekStart: EStartOfTheWeek.SUNDAY,
    });
    return (
      <PqlDraftProvider value={pqlDraft}>
        <List />
      </PqlDraftProvider>
    );
  }

  const router = createMemoryRouter(
    [
      { path: "/:projectId/issues", loader, shouldRevalidate: shouldRevalidateView, Component: Layout },
      { path: "/other", Component: () => <output data-testid="other" /> },
    ],
    { initialEntries: [initialEntry] }
  );
  render(<RouterProvider router={router} />);

  const search = () => router.state.location.search;
  const release = () => act(() => releases.splice(0).forEach((resolve) => resolve()));
  const change = (filters: Parameters<ProjectIssuesFilter["updateFilters"]>[3]) =>
    act(() => store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, filters));
  return { router, store, update, effects, fetches, fetchProjectUserProperties, search, release, change };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("work item view route", () => {
  it("shows the saved preferences on plain navigation and replaces the URL with them", async () => {
    const { router, search, update, fetches, fetchProjectUserProperties } = setup("/other");
    await act(() => router.navigate("/p1/issues"));

    await waitFor(() => expect(search()).toBe("?l=kanban&g=priority"));
    expect(layout()).toBe("p1/kanban");
    expect(fetches).toEqual(["p1/kanban"]);
    expect(fetchProjectUserProperties).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();

    // the plain URL left no history entry behind
    await act(() => router.navigate(-1));
    await screen.findByTestId("other");
  });

  it("shows a link without saving it", async () => {
    const { search, update, fetches, effects } = setup("/p1/issues?l=calendar&cal=week");
    await waitFor(() => expect(layout()).toBe("p1/calendar"));
    expect(search()).toBe("?l=calendar&cal=week");
    expect(fetches).toEqual(["p1/calendar"]);
    expect(effects.refetch).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("replaces invalid params with the canonical URL", async () => {
    const { router, search } = setup("/p1/issues?l=list&o=bogus&g=priority&g=state&other=1");
    await waitFor(() => expect(search()).toBe("?l=list&g=priority&other=1"));
    expect(layout()).toBe("p1/list");
    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("keeps an invalid query as a draft and drops it from the URL", async () => {
    const { search, update } = setup(`/p1/issues?l=list&q=${encodeURIComponent(INVALID)}`);
    await waitFor(() => expect(search()).toBe("?l=list"));
    expect(screen.getByTestId("draft").textContent).toBe(`${INVALID}|Unknown field`);
    expect(screen.getByTestId("pql").textContent).toBe("");
    expect(update).not.toHaveBeenCalled();
  });

  it("turns a UI change into a replace navigation and saves only that key", async () => {
    const { router, store, search, update, fetches, effects, change } = setup("/p1/issues?l=list&o=-priority");
    await waitFor(() => expect(layout()).toBe("p1/list"));

    await change({ layout: EIssueLayoutTypes.SPREADSHEET });
    await waitFor(() => expect(layout()).toBe("p1/spreadsheet"));
    expect(search()).toBe("?l=table&o=-priority");
    expect(router.state.historyAction).toBe("REPLACE");
    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0][2].display_filters?.layout).toBe(EIssueLayoutTypes.SPREADSHEET);
    // the link's order stays out of the saved preferences
    expect(update.mock.calls[0][2].display_filters?.order_by).not.toBe("-priority");
    expect(effects.clear).toHaveBeenCalledOnce();
    expect(fetches).toEqual(["p1/list", "p1/spreadsheet"]);

    await change({ order_by: "priority" });
    await waitFor(() => expect(search()).toBe("?l=table&o=priority"));
    expect(effects.refetch).toHaveBeenCalledOnce();
    expect(store.savedFilters.p1.displayFilters?.order_by).toBe("priority");
  });

  it("shows a change the URL does not carry by rerunning the loader", async () => {
    const { search, update, change } = setup("/p1/issues?l=calendar&cal=week");
    await waitFor(() => expect(screen.getByTestId("weekends").textContent).toBe("false"));

    await change({ calendar: { show_weekends: true } });
    await waitFor(() => expect(screen.getByTestId("weekends").textContent).toBe("true"));
    expect(search()).toBe("?l=calendar&cal=week");
    expect(update.mock.calls[0][2].display_filters?.calendar).toEqual({ layout: "month", show_weekends: true });
  });

  it("builds a change during a navigation on the URL being loaded", async () => {
    const { router, store, search, update, release } = setup("/p1/issues?l=list", { holdValidation: true });
    await waitFor(() => expect(layout()).toBe("p1/list"));

    act(() => {
      void router.navigate("/p1/issues?l=list&q=priority+%3D+high");
    });
    act(() => {
      void store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { layout: EIssueLayoutTypes.SPREADSHEET });
    });
    await waitFor(() => expect(router.state.navigation.location?.search).toBe("?l=table&q=priority+%3D+high"));
    await release();

    await waitFor(() => expect(layout()).toBe("p1/spreadsheet"));
    expect(screen.getByTestId("pql").textContent).toBe("priority = high");
    expect(search()).toBe("?l=table&q=priority+%3D+high");
    expect(update).toHaveBeenCalledOnce();
    expect(Object.keys(update.mock.calls[0][2])).toEqual(["display_filters"]);
    expect(update.mock.calls[0][2].display_filters?.pql).not.toBe("priority = high");
  });

  it("drops a navigation another one replaced", async () => {
    const { router, search, release } = setup("/p1/issues?l=list", { holdValidation: true });
    await waitFor(() => expect(layout()).toBe("p1/list"));

    act(() => {
      void router.navigate("/p1/issues?l=kanban&q=priority+%3D+high");
    });
    await act(() => router.navigate("/p1/issues?l=table"));
    await release();

    await waitFor(() => expect(search()).toBe("?l=table"));
    expect(layout()).toBe("p1/spreadsheet");
    expect(screen.getByTestId("pql").textContent).toBe("");
  });

  it("shows each history entry again without saving", async () => {
    const { router, search, update, change } = setup("/p1/issues?l=list");
    await waitFor(() => expect(layout()).toBe("p1/list"));
    await act(() => router.navigate("/p1/issues?l=calendar&cal=week"));
    await waitFor(() => expect(layout()).toBe("p1/calendar"));

    await act(() => router.navigate(-1));
    await waitFor(() => expect(layout()).toBe("p1/list"));
    await act(() => router.navigate(1));
    await waitFor(() => expect(layout()).toBe("p1/calendar"));
    expect(search()).toBe("?l=calendar&cal=week");
    expect(update).not.toHaveBeenCalled();

    await change({ calendar: { layout: "month" } });
    await waitFor(() => expect(search()).toBe("?l=calendar"));
  });

  it("shows another project from its own saved preferences", async () => {
    const { router, search, effects, fetchProjectUserProperties } = setup(
      `/p1/issues?l=list&q=${encodeURIComponent(INVALID)}`
    );
    await screen.findByTestId("draft");

    await act(() => router.navigate("/p2/issues"));
    await waitFor(() => expect(search()).toBe("?l=table&o=-priority"));
    expect(layout()).toBe("p2/spreadsheet");
    expect(screen.queryByTestId("draft")).toBeNull();
    expect(fetchProjectUserProperties).toHaveBeenCalledTimes(2);
    // the list of the other project was not touched
    expect(effects.clear).not.toHaveBeenCalled();
    expect(effects.refetch).not.toHaveBeenCalled();
  });
});
