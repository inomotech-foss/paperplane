// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { EUserPermissions } from "@plane/constants";
import type { ICycle } from "@plane/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WEB_SWR_CONFIG } from "@/lib/swr-config";
import { CycleStore } from "@/store/cycle.store";
import { useProjectCycles, useWorkspaceCycles } from "./use-cycle-queries";

const api = vi.hoisted(() => ({ getCyclesWithParams: vi.fn(), getWorkspaceCycles: vi.fn() }));
const permissions = vi.hoisted(() => {
  const roles: Record<string, Record<string, number>> = {};
  return { roles };
});

vi.mock("@/services/cycle.service", () => ({
  CycleService: class {
    getCyclesWithParams = api.getCyclesWithParams;
    getWorkspaceCycles = api.getWorkspaceCycles;
  },
}));

const store = new CycleStore({
  router: { projectId: undefined },
  favorite: { addFavorite: vi.fn(), entityMap: {}, removeFavoriteEntity: vi.fn(), removeFavoriteFromStore: vi.fn() },
  projectEstimate: { areEstimateEnabledByProjectId: vi.fn() },
  cycleFilter: {
    archivedCyclesSearchQuery: "",
    searchQuery: "",
    getArchivedFiltersByProjectId: () => ({}),
    getFiltersByProjectId: () => ({}),
  },
});

vi.mock("@/hooks/store/use-cycle", () => ({ useCycle: () => store }));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({
    workspaceProjectsPermissions: permissions.roles,
    getProjectRoleByWorkspaceSlugAndProjectId: (workspaceSlug: string, projectId: string) =>
      permissions.roles[workspaceSlug]?.[projectId],
  }),
}));

class StatusError extends Error {
  constructor(readonly status: number) {
    super(`status ${status}`);
  }
}

const cycle = (id: string, projectId: string): ICycle => ({
  id,
  workspace_id: "w1",
  project_id: projectId,
  name: id,
  description: "",
  start_date: null,
  end_date: null,
  owned_by_id: "u1",
  sort_order: 1,
});

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ ...WEB_SWR_CONFIG, provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
  );
}

const member = (...projectIds: string[]) => {
  permissions.roles = { ws: Object.fromEntries(projectIds.map((id) => [id, EUserPermissions.MEMBER])) };
};

afterEach(() => {
  vi.clearAllMocks();
  permissions.roles = {};
  store.cycleMap = {};
});

describe("useProjectCycles", () => {
  it("loads until the project list arrives", async () => {
    member("p1");
    const response = deferred<ICycle[]>();
    api.getCyclesWithParams.mockReturnValueOnce(response.promise);
    const { result } = renderHook(() => useProjectCycles("ws", "p1"), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      response.resolve([cycle("c1", "p1")]);
      await response.promise;
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeUndefined();
    expect(store.getProjectCycleIds("p1")).toEqual(["c1"]);
  });

  it("reports a failed fetch instead of loading forever, and retries", async () => {
    member("p1");
    api.getCyclesWithParams.mockRejectedValueOnce(new StatusError(403));
    const { result } = renderHook(() => useProjectCycles("ws", "p1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(StatusError));
    expect(result.current.isLoading).toBe(false);

    api.getCyclesWithParams.mockResolvedValueOnce([cycle("c1", "p1")]);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.error).toBeUndefined());
    expect(store.getProjectCycleIds("p1")).toEqual(["c1"]);
  });

  it("loads again for a project it has not fetched yet", async () => {
    member("p1", "p2");
    api.getCyclesWithParams.mockResolvedValueOnce([cycle("c1", "p1")]);
    const { result, rerender } = renderHook(({ projectId }) => useProjectCycles("ws", projectId), {
      wrapper: Wrapper,
      initialProps: { projectId: "p1" },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const response = deferred<ICycle[]>();
    api.getCyclesWithParams.mockReturnValueOnce(response.promise);
    rerender({ projectId: "p2" });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(api.getCyclesWithParams).toHaveBeenLastCalledWith("ws", "p2"));
    await act(async () => {
      response.resolve([cycle("c2", "p2")]);
      await response.promise;
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(store.getProjectCycleIds("p2")).toEqual(["c2"]);
  });

  it("does not count the workspace list as a loaded project", async () => {
    member("p1");
    api.getWorkspaceCycles.mockResolvedValueOnce([cycle("c1", "p1")]);
    const workspace = renderHook(() => useWorkspaceCycles("ws"), { wrapper: Wrapper });
    await waitFor(() => expect(workspace.result.current.isLoading).toBe(false));

    api.getCyclesWithParams.mockReturnValueOnce(new Promise(() => {}));
    const { result } = renderHook(() => useProjectCycles("ws", "p1"), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(api.getCyclesWithParams).toHaveBeenCalledWith("ws", "p1"));
  });

  it("waits for the project role before it fetches", () => {
    const { result } = renderHook(() => useProjectCycles("ws", "p1"), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(api.getCyclesWithParams).not.toHaveBeenCalled();
  });

  it("fetches without a role once the roles are in and the user has none in the project", async () => {
    permissions.roles = { ws: {} };
    api.getCyclesWithParams.mockResolvedValueOnce([cycle("c1", "p1")]);
    const { result } = renderHook(() => useProjectCycles("ws", "p1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(api.getCyclesWithParams).toHaveBeenCalledOnce();
  });

  it("does not fetch again when a second component mounts with the answer cached", async () => {
    member("p1");
    api.getCyclesWithParams.mockResolvedValue([cycle("c1", "p1")]);
    const cache = new Map();
    function SharedCache({ children }: { children: ReactNode }) {
      return <SWRConfig value={{ ...WEB_SWR_CONFIG, provider: () => cache }}>{children}</SWRConfig>;
    }
    const first = renderHook(() => useProjectCycles("ws", "p1"), { wrapper: SharedCache });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();
    // past the dedupe window, which alone would not stop a mount revalidation
    await new Promise((resolve) => setTimeout(resolve, 30));

    const second = renderHook(() => useProjectCycles("ws", "p1"), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SWRConfig value={{ ...WEB_SWR_CONFIG, provider: () => cache, dedupingInterval: 0 }}>{children}</SWRConfig>
      ),
    });
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(second.result.current.isLoading).toBe(false);
    expect(api.getCyclesWithParams).toHaveBeenCalledOnce();
  });

  it("fetches a lazy query that is asked before the roles are in", async () => {
    api.getCyclesWithParams.mockResolvedValueOnce([cycle("c1", "p1")]);
    const { result } = renderHook(() => useProjectCycles("ws", "p1", { lazy: true }), { wrapper: Wrapper });

    await act(() => result.current.ensureLoaded());

    expect(api.getCyclesWithParams).toHaveBeenCalledOnce();
    expect(store.getProjectCycleIds("p1")).toEqual(["c1"]);
  });

  it("fetches a lazy query only once it is asked to", async () => {
    member("p1");
    api.getCyclesWithParams.mockResolvedValue([cycle("c1", "p1")]);
    const { result } = renderHook(() => useProjectCycles("ws", "p1", { lazy: true }), { wrapper: Wrapper });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(api.getCyclesWithParams).not.toHaveBeenCalled();

    await act(() => result.current.ensureLoaded());
    await act(() => result.current.ensureLoaded());

    expect(api.getCyclesWithParams).toHaveBeenCalledOnce();
    expect(store.getProjectCycleIds("p1")).toEqual(["c1"]);
  });
});
