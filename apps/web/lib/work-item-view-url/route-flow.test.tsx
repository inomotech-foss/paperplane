// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { observer } from "mobx-react";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLoaderData,
  useLocation,
  useParams,
} from "react-router";
import useSWR, { SWRConfig } from "swr";
import type { LoaderFunctionArgs } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EIssueFilterType } from "@plane/constants";
import type { IProjectUserPropertiesResponse } from "@plane/types";
import { EIssueLayoutTypes, EIssuesStoreType, EStartOfTheWeek } from "@plane/types";
import { ProjectIssuesFilter } from "@/store/issue/project/filter.store";
import { getPageBaseline, getWorkItemPage } from "./pages";
import { PqlDraftProvider, usePqlDraft } from "./pql-draft";
import { getViewRoute } from "./registry";
import { loadViewRoute, shouldRevalidateView } from "./route";
import type { TViewBinding } from "./route";
import type { TWorkItemViewState } from "./types";
import { useWorkItemViewRoute } from "./use-view-route";

const page = getWorkItemPage(EIssuesStoreType.PROJECT);
const INVALID = "nope = 1";
const INVALID_LINK = "/p1/issues?l=list&q=nope+%3D+1";
const CLOCK = { today: "2026-10-09", weekStart: EStartOfTheWeek.MONDAY };

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
const draftText = () => screen.queryByTestId("draft")?.textContent;
const makeEffects = () => ({ clear: vi.fn(), refetch: vi.fn(), setRichFilters: vi.fn() });

type TOptions = {
  holdValidation?: boolean;
  /** The loader knows the feature is off. */
  featureOff?: boolean;
  /** The feature guard redirects once the project has loaded. */
  guardRedirects?: boolean;
  /** What missing params mean, like a saved view's config. */
  baseline?: TWorkItemViewState;
};

/** Browser history, so a reload or back/forward shows the URL before the loader runs, as in a browser. */
const setup = (initialEntries: string[], options: TOptions = {}) => {
  // pushed, not replaced: an earlier test may have left the history at an older entry
  initialEntries.forEach((entry) => window.history.pushState(null, "", entry));
  const historyLength = window.history.length;
  const fetchProjectUserProperties = vi.fn(async (_: string, projectId: string) => SAVED[projectId]);
  const store = new ProjectIssuesFilter({
    projectId: "p1",
    workspaceSlug: "ws",
    currentUserId: "u1",
    projectIssues: { clear: vi.fn(), fetchIssuesWithExistingPagination: vi.fn(async () => undefined) },
    rootStore: { memberRoot: { project: { fetchProjectUserProperties } }, user: { data: { id: "u1" } } },
  });
  const update = vi
    .spyOn(store.projectService, "updateProjectUserProperties")
    .mockImplementation(async (_, projectId) => SAVED[projectId]);
  const effects: Record<string, ReturnType<typeof makeEffects>> = { p1: makeEffects(), p2: makeEffects() };
  /** Layouts that mounted and so fetched their list. */
  const fetches: string[] = [];
  /** The search of every render of the route. */
  const rendered: string[] = [];
  const releases: (() => void)[] = [];
  const validatePql = vi.fn(async (pql: string) => {
    if (options.holdValidation) await new Promise<void>((resolve) => releases.push(resolve));
    return pql === INVALID ? { valid: false, error: "Unknown field" } : { valid: true };
  });

  const binding = (projectId: string): TViewBinding => ({
    page,
    entityId: projectId,
    deps: {
      loadSaved: () => store.loadSavedFilters("ws", projectId),
      validatePql,
      clock: () => CLOCK,
      loadBaseline: options.baseline && (async () => options.baseline ?? getPageBaseline(page)),
    },
    store,
    effects: effects[projectId] ?? makeEffects(),
    redirect: () => (options.featureOff ? "/other" : undefined),
  });
  const loader = vi.fn(({ request, params }: LoaderFunctionArgs) =>
    loadViewRoute(request, binding(params.projectId ?? ""))
  );

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
    rendered.push(useLocation().search);
    useWorkItemViewRoute(data, page, projectId);
    if (options.guardRedirects) return <Navigate to="/other" replace />;
    return (
      <PqlDraftProvider value={data.draft}>
        <List />
      </PqlDraftProvider>
    );
  }

  /** Project-level data the parent route fetches, like ProjectAuthWrapper. */
  const projectFetches = vi.fn(async (key: string) => key);
  const projectMounts = vi.fn();
  function Project() {
    const { projectId = "" } = useParams();
    useSWR(`PROJECT_DETAILS_${projectId}`, projectFetches);
    useEffect(() => projectMounts(), []);
    return <Outlet />;
  }

  const router = createBrowserRouter([
    {
      path: "/:projectId",
      Component: Project,
      children: [{ path: "issues", loader, shouldRevalidate: shouldRevalidateView, Component: Layout }],
    },
    { path: "/other", Component: () => <output data-testid="other" /> },
  ]);
  routers.push(router);
  const view = render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <RouterProvider router={router} />
    </SWRConfig>
  );

  const search = () => router.state.location.search;
  const release = () => act(() => releases.splice(0).forEach((resolve) => resolve()));
  const change = (filters: Parameters<ProjectIssuesFilter["updateFilters"]>[3], projectId = "p1") =>
    act(() => store.updateFilters("ws", projectId, EIssueFilterType.DISPLAY_FILTERS, filters));
  return {
    router,
    store,
    update,
    effects,
    fetches,
    rendered,
    loader,
    validatePql,
    fetchProjectUserProperties,
    projectFetches,
    projectMounts,
    search,
    release,
    change,
    unmount: view.unmount,
    historyLength,
  };
};

const idle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));

/** Browser routers listen to the shared window history until disposed. */
const routers: { dispose: () => void }[] = [];

afterEach(() => {
  routers.splice(0).forEach((router) => router.dispose());
  vi.restoreAllMocks();
});

describe("work item view route", () => {
  it("shows the saved preferences on plain navigation without rendering or keeping the plain URL", async () => {
    const { router, search, update, fetches, rendered, fetchProjectUserProperties, historyLength } = setup(["/other"]);
    await act(() => router.navigate("/p1/issues"));

    await waitFor(() => expect(search()).toBe("?l=kanban&g=priority"));
    expect(window.history.length).toBe(historyLength + 1);
    expect(layout()).toBe("p1/kanban");
    expect(rendered).not.toContain("");
    expect(fetches).toEqual(["p1/kanban"]);
    expect(fetchProjectUserProperties).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();

    await act(() => router.navigate(-1));
    await screen.findByTestId("other");
  });

  it("replaces a plain URL on reload", async () => {
    const { router, search, rendered, historyLength } = setup(["/other", "/p1/issues"]);
    await waitFor(() => expect(search()).toBe("?l=kanban&g=priority"));
    expect(rendered).not.toContain("");
    expect(window.history.length).toBe(historyLength);
    expect(router.state.historyAction).toBe("REPLACE");

    await act(() => router.navigate(-1));
    await screen.findByTestId("other");
  });

  it("replaces a plain URL reached with back, keeping the entries around it", async () => {
    const { router, search, rendered, historyLength } = setup(["/p1/issues", "/other"]);
    await screen.findByTestId("other");

    await act(() => router.navigate(-1));
    await waitFor(() => expect(search()).toBe("?l=kanban&g=priority"));
    expect(rendered).not.toContain("");
    expect(window.history.length).toBe(historyLength);
    await act(() => router.navigate(1));
    await screen.findByTestId("other");
    await act(() => router.navigate(-1));
    await waitFor(() => expect(layout()).toBe("p1/kanban"));
    expect(search()).toBe("?l=kanban&g=priority");
  });

  it("replaces the entry when a plain link leads to the view already shown", async () => {
    const { router, search, historyLength } = setup(["/p1/issues?l=kanban&g=priority"]);
    await waitFor(() => expect(layout()).toBe("p1/kanban"));
    await act(() => router.navigate("/p1/issues"));
    await waitFor(() => expect(search()).toBe("?l=kanban&g=priority"));
    expect(window.history.length).toBe(historyLength);
  });

  it("adds an entry when a plain link leads to another view of the page", async () => {
    const { router, search, historyLength } = setup(["/p1/issues?l=list"]);
    await waitFor(() => expect(layout()).toBe("p1/list"));
    await act(() => router.navigate("/p1/issues"));
    await waitFor(() => expect(search()).toBe("?l=kanban&g=priority"));
    await waitFor(() => expect(search()).toBe("?l=kanban&g=priority"));
    expect(window.history.length).toBe(historyLength + 1);
    await act(() => router.navigate(-1));
    await waitFor(() => expect(layout()).toBe("p1/list"));
  });

  it("keeps a plain URL when the saved preferences fail to load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { router, search, fetchProjectUserProperties } = setup(["/other"]);
    fetchProjectUserProperties.mockRejectedValueOnce(new Error("forbidden"));
    await act(() => router.navigate("/p1/issues"));
    await waitFor(() => expect(layout()).toBe("p1/list"));
    expect(search()).toBe("");

    await act(() => router.navigate("/p1/issues"));
    await waitFor(() => expect(search()).toBe("?l=kanban&g=priority"));
  });

  it("shows a link without saving it", async () => {
    const { search, update, fetches, effects } = setup(["/p1/issues?l=calendar&cal=week"]);
    await waitFor(() => expect(layout()).toBe("p1/calendar"));
    expect(search()).toBe("?l=calendar&cal=week");
    expect(fetches).toEqual(["p1/calendar"]);
    expect(effects.p1.refetch).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("replaces invalid params with the canonical URL before rendering", async () => {
    const { router, search, rendered } = setup(["/p1/issues?l=list&o=bogus&g=priority&g=state&other=1"]);
    await waitFor(() => expect(search()).toBe("?l=list&g=priority&other=1"));
    expect(layout()).toBe("p1/list");
    expect(rendered.every((entry) => entry === "?l=list&g=priority&other=1")).toBe(true);
    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("loads a URL with a quoted query once", async () => {
    const { search, loader } = setup(["/p1/issues?l=list&q=priority+%3D+'high'"]);
    await waitFor(() => expect(screen.getByTestId("pql").textContent).toBe("priority = 'high'"));
    await idle();
    expect(loader).toHaveBeenCalledOnce();
    expect(search()).toBe("?l=list&q=priority+%3D+%27high%27");
  });

  it("keeps an invalid query in the URL as a draft, through changes and reloads", async () => {
    const first = setup([INVALID_LINK]);
    await waitFor(() => expect(draftText()).toBe(`${INVALID}|Unknown field`));
    expect(first.search()).toBe("?l=list&q=nope+%3D+1");
    expect(screen.getByTestId("pql").textContent).toBe("");

    await first.change({ order_by: "priority" });
    await waitFor(() => expect(first.search()).toBe("?l=list&o=priority&q=nope+%3D+1"));
    expect(draftText()).toBe(`${INVALID}|Unknown field`);
    expect(first.update.mock.calls[0][2].display_filters?.pql).not.toBe(INVALID);
    first.unmount();

    const reloaded = setup([`/p1/issues${first.search()}`]);
    await waitFor(() => expect(draftText()).toBe(`${INVALID}|Unknown field`));
    expect(reloaded.search()).toBe("?l=list&o=priority&q=nope+%3D+1");
  });

  it("drops a cleared draft from the URL, so a reload does not bring it back", async () => {
    const first = setup([INVALID_LINK]);
    await waitFor(() => expect(draftText()).toBe(`${INVALID}|Unknown field`));
    // what the query bar's Clear sends
    await first.change({ pql: "" });
    await waitFor(() => expect(first.search()).toBe("?l=list"));
    expect(draftText()).toBeUndefined();
    first.unmount();

    setup([`/p1/issues${first.search()}`]);
    await waitFor(() => expect(layout()).toBe("p1/list"));
    expect(draftText()).toBeUndefined();
  });

  it("lets the loader send the visitor away before it loads anything", async () => {
    const { router, rendered, fetchProjectUserProperties } = setup(["/other"], { featureOff: true });
    await act(() => router.navigate("/p1/issues"));
    await screen.findByTestId("other");
    expect(router.state.location.pathname).toBe("/other");
    expect(fetchProjectUserProperties).not.toHaveBeenCalled();
    expect(rendered).toEqual([]);
  });

  it("lets the feature guard redirect after the URL was made canonical", async () => {
    const { router } = setup(["/p1/issues"], { guardRedirects: true });
    await screen.findByTestId("other");
    await idle();
    expect(router.state.location.pathname).toBe("/other");
  });

  it("turns a UI change into a replace navigation and saves only that key", async () => {
    const { router, store, search, update, fetches, effects, change } = setup(["/p1/issues?l=list&o=-priority"]);
    await waitFor(() => expect(layout()).toBe("p1/list"));

    await change({ layout: EIssueLayoutTypes.SPREADSHEET });
    await waitFor(() => expect(layout()).toBe("p1/spreadsheet"));
    expect(search()).toBe("?l=table&o=-priority");
    expect(router.state.historyAction).toBe("REPLACE");
    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0][2].display_filters?.layout).toBe(EIssueLayoutTypes.SPREADSHEET);
    // the link's order stays out of the saved preferences
    expect(update.mock.calls[0][2].display_filters?.order_by).not.toBe("-priority");
    expect(effects.p1.clear).toHaveBeenCalledOnce();
    expect(fetches).toEqual(["p1/list", "p1/spreadsheet"]);

    await change({ order_by: "priority" });
    await waitFor(() => expect(search()).toBe("?l=table&o=priority"));
    expect(effects.p1.refetch).toHaveBeenCalledOnce();
    expect(store.savedFilters.p1.displayFilters?.order_by).toBe("priority");
  });

  it("builds a change on the baseline the loader returned", async () => {
    const pageBaseline = getPageBaseline(page);
    const baseline: TWorkItemViewState = {
      ...pageBaseline,
      displayFilters: { ...pageBaseline.displayFilters, order_by: "-priority" },
    };
    const { search, loader, change } = setup(["/p1/issues?l=list"], { baseline });
    await waitFor(() => expect(layout()).toBe("p1/list"));

    // the page baseline already orders by this, so only the loader's baseline needs the param
    await change({ order_by: pageBaseline.displayFilters.order_by });
    await waitFor(() => expect(search()).toBe(`?l=list&o=${pageBaseline.displayFilters.order_by}`));
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("reruns only the view loader on a view change, not the project route", async () => {
    const { store, search, fetches, projectFetches, projectMounts, change } = setup(["/p1/issues?l=list"]);
    await waitFor(() => expect(layout()).toBe("p1/list"));
    await waitFor(() => expect(projectFetches).toHaveBeenCalledOnce());

    await change({ layout: EIssueLayoutTypes.KANBAN });
    await waitFor(() => expect(layout()).toBe("p1/kanban"));
    await act(() => store.updateFilterExpression("ws", "p1", { priority__in: "urgent" }));
    await waitFor(() => expect(search()).toContain("f=priority:in:urgent"));

    expect(fetches).toEqual(["p1/list", "p1/kanban"]);
    expect(projectFetches).toHaveBeenCalledOnce();
    expect(projectMounts).toHaveBeenCalledOnce();
  });

  it("shows a setting the URL does not hold in place, without a navigation", async () => {
    const { search, update, loader, change } = setup(["/p1/issues?l=calendar&cal=week"]);
    await waitFor(() => expect(screen.getByTestId("weekends").textContent).toBe("false"));

    await change({ calendar: { show_weekends: true } });
    await waitFor(() => expect(screen.getByTestId("weekends").textContent).toBe("true"));
    expect(search()).toBe("?l=calendar&cal=week");
    expect(loader).toHaveBeenCalledOnce();
    expect(update.mock.calls[0][2].display_filters?.calendar).toEqual({ layout: "month", show_weekends: true });
  });

  it("does not navigate for a change the URL already shows", async () => {
    const { search, loader, change } = setup(["/p1/issues?l=list&o=priority"]);
    await waitFor(() => expect(layout()).toBe("p1/list"));
    await change({ order_by: "priority" });
    await idle();
    expect(loader).toHaveBeenCalledOnce();
    expect(search()).toBe("?l=list&o=priority");
  });

  it("builds a change during a navigation on the URL being loaded", async () => {
    const { router, store, search, update, release } = setup(["/p1/issues?l=list"], { holdValidation: true });
    await release();
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

  it("lets a navigation to another page finish when a change comes in meanwhile, and saves the change", async () => {
    const { router, store, update, release } = setup(["/p1/issues?l=list"], { holdValidation: true });
    await waitFor(() => expect(layout()).toBe("p1/list"));

    act(() => {
      void router.navigate("/p2/issues?l=table&q=priority+%3D+high");
    });
    await waitFor(() => expect(router.state.navigation.state).toBe("loading"));
    await act(() =>
      store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { layout: EIssueLayoutTypes.CALENDAR })
    );
    await release();

    await waitFor(() => expect(layout()).toBe("p2/spreadsheet"));
    expect(router.state.location.pathname).toBe("/p2/issues");
    expect(update).toHaveBeenCalledWith("ws", "p1", {
      display_filters: expect.objectContaining({ layout: EIssueLayoutTypes.CALENDAR }),
    });
  });

  it("shows display properties a URL changes", async () => {
    const { router, store } = setup(["/p1/issues?l=list"]);
    await waitFor(() => expect(layout()).toBe("p1/list"));
    await act(() => router.navigate("/p1/issues?l=list&p=-labels"));
    await waitFor(() => expect(store.getIssueFilters("p1")?.displayProperties?.labels).toBe(false));
  });

  it("drops a navigation another one replaced", async () => {
    const { router, search, release } = setup(["/p1/issues?l=list"], { holdValidation: true });
    await waitFor(() => expect(layout()).toBe("p1/list"));

    act(() => {
      void router.navigate("/p1/issues?l=kanban&q=priority+%3D+high");
    });
    await act(() => router.navigate("/p1/issues?l=table"));
    await release();

    await waitFor(() => expect(search()).toBe("?l=table"));
    expect(layout()).toBe("p1/spreadsheet");
    await waitFor(() => expect(screen.getByTestId("pql").textContent).toBe(""));
  });

  it("shows each history entry again without saving", async () => {
    const { router, search, update, change } = setup(["/p1/issues?l=list"]);
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
    const { router, search, fetchProjectUserProperties } = setup([INVALID_LINK]);
    await screen.findByTestId("draft");

    await act(() => router.navigate("/p2/issues"));
    await waitFor(() => expect(search()).toBe("?l=table&o=-priority"));
    expect(layout()).toBe("p2/spreadsheet");
    await waitFor(() => expect(screen.queryByTestId("draft")).toBeNull());
    expect(fetchProjectUserProperties).toHaveBeenCalledTimes(2);
  });

  it("leaves the list of a project that is not shown to its own mount", async () => {
    const { router, effects } = setup(["/p2/issues?l=table"]);
    await waitFor(() => expect(layout()).toBe("p2/spreadsheet"));
    await act(() => router.navigate("/p1/issues?l=list"));
    await waitFor(() => expect(layout()).toBe("p1/list"));

    // p2 has filters in the store, but its list is not on screen while this loads
    await act(() => router.navigate("/p2/issues?l=list&o=priority"));
    await waitFor(() => expect(layout()).toBe("p2/list"));
    expect(effects.p2.clear).not.toHaveBeenCalled();
    expect(effects.p2.refetch).not.toHaveBeenCalled();
  });

  it("shows changes in place once the page is left", async () => {
    const { router, store, change } = setup(["/p1/issues?l=list"]);
    await waitFor(() => expect(layout()).toBe("p1/list"));
    await act(() => router.navigate("/other"));
    await screen.findByTestId("other");
    expect(getViewRoute(page, "p1")).toBeUndefined();

    await change({ order_by: "priority" });
    expect(router.state.location.pathname).toBe("/other");
    expect(store.getIssueFilters("p1")?.displayFilters?.order_by).toBe("priority");
  });
});
