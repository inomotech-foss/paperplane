// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { act, render, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { TPeekIssue } from "@/store/issue/issue-details/root.store";
import { createPeekBinding, findIssueIdByRef, getPeekRoute, readPeekParam, withPeekParam } from "./peek";
import type { TPeekableIssue } from "./peek";
import { usePeekRoute } from "./use-peek-route";

const peekOf = (issueId: string, nestingLevel?: number): TPeekIssue => ({
  workspaceSlug: "w",
  projectId: "p1",
  issueId,
  nestingLevel,
});

const LOADED: Record<string, TPeekableIssue> = {
  i1: { id: "i1", project_id: "p1", sequence_id: 1 },
  i2: { id: "i2", project_id: "p1", sequence_id: 2 },
};
const REMOTE: TPeekableIssue = { id: "i9", project_id: "p1", sequence_id: 9 };

const makeBinding = () => {
  const show = vi.fn<(peek: TPeekIssue | undefined) => void>();
  const notFound = vi.fn();
  const lookupIssue = vi.fn(async ({ sequenceId }: { sequenceId: number }) =>
    sequenceId === REMOTE.sequence_id ? REMOTE : undefined
  );
  const binding = createPeekBinding("w", {
    getIssue: (issueId) => LOADED[issueId],
    findIssueId: (ref) => findIssueIdByRef(Object.values(LOADED), () => "web", ref),
    getProjectIdentifier: () => "web",
    lookupIssue,
    show,
    notFound,
  });
  return { binding, show, notFound, lookupIssue };
};

const renderRoute = (url: string, binding: ReturnType<typeof makeBinding>["binding"]) => {
  function Page() {
    usePeekRoute(binding);
    return null;
  }
  const router = createMemoryRouter([{ path: "/p1/issues", element: <Page /> }, { path: "/other" }], {
    initialEntries: [url],
  });
  render(<RouterProvider router={router} />);
  return router;
};

describe("peek search helpers", () => {
  it("puts the peek after the view params and before foreign ones", () => {
    expect(withPeekParam("?l=list&other=x", { projectIdentifier: "WEB", sequenceId: 3 })).toBe(
      "l=list&peek=WEB-3&other=x"
    );
  });

  it("replaces and removes the peek", () => {
    expect(withPeekParam("l=list&peek=WEB-1", { projectIdentifier: "WEB", sequenceId: 2 })).toBe("l=list&peek=WEB-2");
    expect(withPeekParam("l=list&peek=WEB-1", undefined)).toBe("l=list");
  });

  it("reads only a valid peek", () => {
    expect(readPeekParam("?peek=web-7")).toEqual({ projectIdentifier: "WEB", sequenceId: 7 });
    expect(readPeekParam("?peek=nope")).toBeUndefined();
  });
});

describe("usePeekRoute", () => {
  it("shows a loaded work item without a request", async () => {
    const { binding, show, lookupIssue } = makeBinding();
    renderRoute("/p1/issues?l=list&peek=WEB-2", binding);
    await waitFor(() => expect(show).toHaveBeenLastCalledWith(peekOf("i2")));
    expect(lookupIssue).not.toHaveBeenCalled();
  });

  it("looks up a work item that is not loaded", async () => {
    const { binding, show, lookupIssue } = makeBinding();
    renderRoute("/p1/issues?peek=WEB-9", binding);
    await waitFor(() => expect(show).toHaveBeenLastCalledWith(peekOf("i9")));
    expect(lookupIssue).toHaveBeenCalledTimes(1);
  });

  it("reports a work item it cannot find and drops it from the URL", async () => {
    const { binding, show, notFound } = makeBinding();
    const router = renderRoute("/p1/issues?l=list&peek=WEB-5", binding);
    await waitFor(() => expect(router.state.location.search).toBe("?l=list"));
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(show.mock.calls.every(([peek]) => peek === undefined)).toBe(true);
  });

  it("writes an opened peek to the URL with replace and keeps its details", async () => {
    const { binding, show, lookupIssue } = makeBinding();
    const router = renderRoute("/p1/issues?l=list", binding);
    act(() => {
      expect(getPeekRoute()?.onPeek(peekOf("i1", 2))).toBe(true);
    });
    await waitFor(() => expect(router.state.location.search).toBe("?l=list&peek=WEB-1"));
    expect(router.state.historyAction).toBe("REPLACE");
    await waitFor(() => expect(show).toHaveBeenLastCalledWith(peekOf("i1", 2)));
    expect(lookupIssue).not.toHaveBeenCalled();
  });

  it("removes the peek from the URL on close", async () => {
    const { binding, show } = makeBinding();
    const router = renderRoute("/p1/issues?l=list&peek=WEB-1", binding);
    await waitFor(() => expect(show).toHaveBeenLastCalledWith(peekOf("i1")));
    act(() => {
      getPeekRoute()?.onPeek(undefined);
    });
    await waitFor(() => expect(router.state.location.search).toBe("?l=list"));
    await waitFor(() => expect(show).toHaveBeenLastCalledWith(undefined));
  });

  it("leaves a peek without a URL form to the store and clears the URL peek", async () => {
    const { binding, show } = makeBinding();
    const router = renderRoute("/p1/issues?peek=WEB-1", binding);
    await waitFor(() => expect(show).toHaveBeenLastCalledWith(peekOf("i1")));
    act(() => {
      expect(getPeekRoute()?.onPeek({ ...peekOf("i1"), isArchived: true })).toBe(false);
    });
    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("closes its peek and unregisters when the page goes", async () => {
    const { binding, show } = makeBinding();
    const router = renderRoute("/p1/issues?peek=WEB-1", binding);
    await waitFor(() => expect(show).toHaveBeenLastCalledWith(peekOf("i1")));
    await act(() => router.navigate("/other"));
    expect(show).toHaveBeenLastCalledWith(undefined);
    expect(getPeekRoute()).toBeUndefined();
  });
});
