// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { EUserPermissions } from "@plane/constants";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WEB_SWR_CONFIG } from "@/lib/swr-config";
import { useProjectStates, useWorkspaceStates } from "./use-state-queries";

const api = vi.hoisted(() => ({ fetchProjectStates: vi.fn(), fetchWorkspaceStates: vi.fn() }));

vi.mock("@/hooks/store/use-project-state", () => ({ useProjectState: () => api }));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({
    workspaceProjectsPermissions: { ws: { p1: EUserPermissions.MEMBER } },
    getProjectRoleByWorkspaceSlugAndProjectId: () => EUserPermissions.MEMBER,
  }),
}));

class StatusError extends Error {
  constructor(readonly status: number) {
    super(`status ${status}`);
  }
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ ...WEB_SWR_CONFIG, provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useProjectStates", () => {
  it("loads until the project states arrive", async () => {
    api.fetchProjectStates.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useProjectStates("ws", "p1"), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(api.fetchProjectStates).toHaveBeenCalledWith("ws", "p1");
  });

  it("reports a failed fetch and retries it", async () => {
    api.fetchProjectStates.mockRejectedValueOnce(new StatusError(403));
    const { result } = renderHook(() => useProjectStates("ws", "p1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(StatusError));
    expect(result.current.isLoading).toBe(false);

    api.fetchProjectStates.mockResolvedValueOnce([]);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.error).toBeUndefined());
  });

  it("counts the workspace states as an answer for the project", async () => {
    api.fetchWorkspaceStates.mockResolvedValueOnce([]);
    const { result } = renderHook(
      () => ({ workspace: useWorkspaceStates("ws"), project: useProjectStates("ws", "p1", { lazy: true }) }),
      { wrapper: Wrapper }
    );

    expect(result.current.project.isLoading).toBe(false);
    await waitFor(() => expect(result.current.workspace.isLoading).toBe(false));
    await act(() => result.current.project.ensureLoaded());

    expect(api.fetchProjectStates).not.toHaveBeenCalled();
  });

  it("still answers from the workspace states when the project fetch fails", async () => {
    api.fetchWorkspaceStates.mockResolvedValueOnce([]);
    api.fetchProjectStates.mockRejectedValueOnce(new StatusError(403));
    const { result } = renderHook(
      () => ({ workspace: useWorkspaceStates("ws"), project: useProjectStates("ws", "p1") }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(api.fetchProjectStates).toHaveBeenCalled());
    await waitFor(() => expect(result.current.workspace.isLoading).toBe(false));
    expect(result.current.project.error).toBeUndefined();
    expect(result.current.project.isLoading).toBe(false);
  });
});
