// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { act, render, screen, waitFor } from "@testing-library/react";
import { observer } from "mobx-react";
import { createMemoryRouter, RouterProvider, useLoaderData, useParams } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EIssueFilterType } from "@plane/constants";
import type { IIssueFilters, IProjectUserPropertiesResponse } from "@plane/types";
import { EIssueLayoutTypes, EIssuesStoreType, EStartOfTheWeek } from "@plane/types";
import { ProjectIssuesFilter } from "@/store/issue/project/filter.store";
import { getWorkItemPage } from "./pages";
import { useWorkItemViewUrl, WorkItemViewUrlProvider } from "./provider";
import type { TViewUrlAdapter } from "./provider";
import { parseViewRequest, shouldRevalidateView } from "./route";

const page = getWorkItemPage(EIssuesStoreType.PROJECT);

const loader = ({ request }: LoaderFunctionArgs) => ({ view: parseViewRequest(request, page) });

const properties = (display_filters: IProjectUserPropertiesResponse["display_filters"]) => ({
  rich_filters: {},
  display_filters,
  display_properties: {},
  sort_order: 0,
  preferences: { pages: { block_display: false }, navigation: { default_tab: "", hide_in_more_menu: [] } },
});

const SAVED: Record<string, IProjectUserPropertiesResponse> = {
  p1: properties({ layout: EIssueLayoutTypes.KANBAN, group_by: "priority" }),
  p2: properties({ layout: EIssueLayoutTypes.SPREADSHEET, order_by: "-priority" }),
};

type TSetup = {
  /** Holds back loading the saved preferences until resolved. */
  holdLoad?: boolean;
  /** Holds back query checks until resolved. */
  holdValidation?: boolean;
  invalidPql?: string;
  /** Makes the first read of the saved preferences throw. */
  breakApply?: boolean;
};

const setup = (initialEntry: string, options: TSetup = {}) => {
  const projectIssues = { clear: vi.fn(), fetchIssuesWithExistingPagination: vi.fn() };
  const releases: (() => void)[] = [];
  const load = vi.fn(async (_: string, projectId: string) => {
    if (options.holdLoad) await new Promise<void>((resolve) => releases.push(resolve));
    return SAVED[projectId];
  });
  const members = { getProjectUserProperties: () => null, fetchProjectUserProperties: load };
  const store = new ProjectIssuesFilter({
    projectId: "p1",
    currentUserId: "u1",
    projectIssues,
    rootStore: { memberRoot: { project: members } },
  });
  const update = vi
    .spyOn(store.projectService, "updateProjectUserProperties")
    .mockImplementation(async (_, projectId) => SAVED[projectId]);
  const effects = { clear: vi.fn(), refetch: vi.fn(), setRichFilters: vi.fn() };
  const adapters = new Map<string, TViewUrlAdapter>();
  let broken = 0;
  const getAdapter = (projectId: string) => {
    const adapter = adapters.get(projectId) ?? {
      key: projectId,
      entityId: projectId,
      page,
      store,
      getSaved: (): IIssueFilters | undefined => {
        if (options.breakApply && broken++ === 0) throw new Error("broken");
        return store.savedFilters[projectId];
      },
      loadSaved: () => store.loadSavedFilters("ws", projectId),
      effects,
      validatePql: async (pql: string) => {
        if (options.holdValidation) await new Promise<void>((resolve) => releases.push(resolve));
        return pql === options.invalidPql ? "Unknown field" : undefined;
      },
    };
    adapters.set(projectId, adapter);
    return adapter;
  };

  const List = observer(function List() {
    const { projectId = "" } = useParams();
    const context = useWorkItemViewUrl();
    const layout = store.getIssueFilters(projectId)?.displayFilters?.layout;
    return (
      <>
        <output data-testid="layout">{layout}</output>
        <output data-testid="query-bar">{context?.queryBarId}</output>
        {context?.pqlDraft && (
          <output data-testid="draft">{`${context.pqlDraft.query}|${context.pqlDraft.error}`}</output>
        )}
      </>
    );
  });

  const Gate = observer(function Gate() {
    return useWorkItemViewUrl()?.ready ? <List /> : <output data-testid="loading" />;
  });

  function Layout() {
    const { view } = useLoaderData<typeof loader>();
    const { projectId = "" } = useParams();
    return (
      <WorkItemViewUrlProvider adapter={getAdapter(projectId)} parsed={view} weekStart={EStartOfTheWeek.SUNDAY}>
        <Gate />
      </WorkItemViewUrlProvider>
    );
  }

  const router = createMemoryRouter(
    [{ path: "/:projectId/issues", loader, shouldRevalidate: shouldRevalidateView, Component: Layout }],
    { initialEntries: [initialEntry] }
  );
  render(<RouterProvider router={router} />);

  const search = () => router.state.location.search;
  const release = () => act(() => releases.splice(0).forEach((resolve) => resolve()));
  return { router, store, load, update, effects, search, release };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WorkItemViewUrlProvider", () => {
  it("shows and writes the saved preferences on plain navigation", async () => {
    const { router, search, update } = setup("/p1/issues");
    await waitFor(() => expect(search()).toBe("?l=kanban&g=priority"));
    expect(screen.getByTestId("layout").textContent).toBe(EIssueLayoutTypes.KANBAN);
    expect(router.state.historyAction).toBe("REPLACE");
    expect(update).not.toHaveBeenCalled();
  });

  it("waits for the saved preferences before showing the list", async () => {
    const { release, search } = setup("/p1/issues?l=list", { holdLoad: true });
    await screen.findByTestId("loading");
    await release();
    await waitFor(() => expect(screen.getByTestId("layout").textContent).toBe(EIssueLayoutTypes.LIST));
    expect(search()).toBe("?l=list");
  });

  it("shows a link over different saved preferences without saving it", async () => {
    const { store, search, update } = setup("/p1/issues?l=list&o=-created_at");
    await waitFor(() => expect(screen.getByTestId("layout").textContent).toBe(EIssueLayoutTypes.LIST));
    expect(store.getIssueFilters("p1")?.displayFilters?.order_by).toBe("-created_at");
    expect(store.savedFilters.p1.displayFilters?.layout).toBe(EIssueLayoutTypes.KANBAN);
    expect(search()).toBe("?l=list&o=-created_at");
    expect(update).not.toHaveBeenCalled();
  });

  it("drops invalid params and keeps foreign ones", async () => {
    const { search } = setup("/p1/issues?other=1&l=list&g=nope");
    await waitFor(() => expect(search()).toBe("?l=list&other=1"));
  });

  it("writes UI changes with replace and saves only the changed key", async () => {
    const { router, store, search, update } = setup("/p1/issues?l=list&o=-created_at");
    await waitFor(() => expect(screen.getByTestId("layout").textContent).toBe(EIssueLayoutTypes.LIST));
    const before = router.state.location.key;

    await act(() =>
      store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { layout: EIssueLayoutTypes.CALENDAR })
    );

    await waitFor(() => expect(search()).toBe("?l=calendar"));
    expect(router.state.historyAction).toBe("REPLACE");
    expect(router.state.location.key).not.toBe(before);
    const persisted = update.mock.calls[0][2].display_filters;
    expect(persisted?.layout).toBe(EIssueLayoutTypes.CALENDAR);
    expect(persisted?.order_by).toBe(store.savedFilters.p1.displayFilters?.order_by);
    expect(persisted?.order_by).not.toBe("-created_at");
  });

  it("applies the URL on back and forward", async () => {
    const { router, effects } = setup("/p1/issues?l=list");
    await waitFor(() => expect(screen.getByTestId("layout").textContent).toBe(EIssueLayoutTypes.LIST));

    await act(() => router.navigate("/p1/issues?l=table"));
    await waitFor(() => expect(screen.getByTestId("layout").textContent).toBe(EIssueLayoutTypes.SPREADSHEET));
    await act(() => router.navigate(-1));
    await waitFor(() => expect(screen.getByTestId("layout").textContent).toBe(EIssueLayoutTypes.LIST));
    expect(effects.clear).toHaveBeenCalledTimes(2);
  });

  it("applies the saved preferences of the next project", async () => {
    const { router, search } = setup("/p1/issues?l=list");
    await waitFor(() => expect(screen.getByTestId("layout").textContent).toBe(EIssueLayoutTypes.LIST));

    await act(() => router.navigate("/p2/issues"));
    await waitFor(() => expect(search()).toBe("?l=table&o=-priority"));
    expect(screen.getByTestId("layout").textContent).toBe(EIssueLayoutTypes.SPREADSHEET);
  });

  it("keeps an invalid query as a draft and removes it from the URL", async () => {
    const { store, search } = setup("/p1/issues?l=list&q=nope+%3D+1", { invalidPql: "nope = 1" });
    await waitFor(() => expect(search()).toBe("?l=list"));
    expect(screen.getByTestId("draft").textContent).toBe("nope = 1|Unknown field");
    expect(store.getIssueFilters("p1")?.displayFilters?.pql ?? "").toBe("");
  });

  it("does not carry an invalid query's draft to the next project", async () => {
    const { router, search } = setup("/p1/issues?l=list&q=nope", { invalidPql: "nope" });
    await screen.findByTestId("draft");

    await act(() => router.navigate("/p2/issues"));
    await waitFor(() => expect(search()).toBe("?l=table&o=-priority"));
    expect(screen.queryByTestId("draft")).toBeNull();
  });

  it("resets the query bar when back or forward shows another query", async () => {
    const { router } = setup("/p1/issues?l=list&q=a");
    await waitFor(() => expect(screen.getByTestId("layout").textContent).toBe(EIssueLayoutTypes.LIST));
    const before = screen.getByTestId("query-bar").textContent;

    await act(() => router.navigate("/p1/issues?l=list&q=b"));
    await waitFor(() => expect(screen.getByTestId("query-bar").textContent).not.toBe(before));
  });

  it("ends on the last of several quick changes", async () => {
    const { store, search } = setup("/p1/issues?l=list");
    await waitFor(() => expect(screen.getByTestId("layout").textContent).toBe(EIssueLayoutTypes.LIST));

    await act(async () => {
      void store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { layout: EIssueLayoutTypes.CALENDAR });
      await Promise.resolve();
      void store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { layout: EIssueLayoutTypes.LIST });
    });

    await waitFor(() => expect(store.getIssueFilters("p1")?.displayFilters?.layout).toBe(EIssueLayoutTypes.LIST));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(search()).toBe("?l=list");
  });

  it("keeps a URL that is still being checked when the view changes meanwhile", async () => {
    const { router, store, release, search } = setup("/p1/issues?l=list", { holdValidation: true });
    await waitFor(() => expect(screen.getByTestId("layout").textContent).toBe(EIssueLayoutTypes.LIST));

    await act(() => router.navigate("/p1/issues?l=list&q=a"));
    await act(() => store.updateFilters("ws", "p1", EIssueFilterType.DISPLAY_FILTERS, { order_by: "-created_at" }));
    expect(search()).toBe("?l=list&q=a");

    await release();
    await waitFor(() => expect(store.getIssueFilters("p1")?.displayFilters?.pql).toBe("a"));
    expect(search()).toBe("?l=list&q=a");
  });

  it("opens the page when applying the URL fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { search } = setup("/p1/issues?l=calendar", { breakApply: true });
    await waitFor(() => expect(screen.getByTestId("layout").textContent).toBe(EIssueLayoutTypes.LIST));
    expect(search()).toBe("?l=list");
    expect(error).toHaveBeenCalled();
  });

  it("opens the page when the saved preferences never arrive", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      setup("/p1/issues?l=list", { holdLoad: true });
      await screen.findByTestId("loading");
      await act(() => vi.advanceTimersByTimeAsync(20_000));
      await waitFor(() => expect(screen.getByTestId("layout").textContent).toBe(EIssueLayoutTypes.LIST));
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores a slow load for a URL that is no longer shown", async () => {
    const { router, release, search } = setup("/p1/issues?l=list", { holdLoad: true });
    await screen.findByTestId("loading");
    await act(() => router.navigate("/p1/issues?l=calendar"));
    await release();
    await waitFor(() => expect(screen.getByTestId("layout").textContent).toBe(EIssueLayoutTypes.CALENDAR));
    expect(search()).toBe("?l=calendar");
  });
});
