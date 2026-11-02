// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { act, render, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { TPeekIssue } from "@/store/issue/issue-details/root.store";
import { getPeekRoute, readPeekParam, withPeekParam } from "./peek";
import { usePeekRoute } from "./use-peek-route";
import type { TPeekBinding } from "./use-peek-route";

const peekOf = (issueId: string, nestingLevel?: number): TPeekIssue => ({
  workspaceSlug: "w",
  projectId: "p1",
  issueId,
  nestingLevel,
});

const SEQUENCES: Record<string, number> = { i1: 1, i2: 2 };

const makeBinding = () => {
  const show = vi.fn<(peek: TPeekIssue | undefined) => void>();
  const binding: TPeekBinding = {
    toRef: (peek) =>
      peek.isArchived || !SEQUENCES[peek.issueId]
        ? undefined
        : { projectIdentifier: "WEB", sequenceId: SEQUENCES[peek.issueId] },
    resolve: async ({ sequenceId }) => {
      const issueId = Object.keys(SEQUENCES).find((id) => SEQUENCES[id] === sequenceId);
      return issueId ? peekOf(issueId) : undefined;
    },
    show,
  };
  return { binding, show };
};

const renderRoute = (url: string, binding: TPeekBinding) => {
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
  it("shows the peek a link asks for", async () => {
    const { binding, show } = makeBinding();
    renderRoute("/p1/issues?l=list&peek=WEB-2", binding);
    await waitFor(() => expect(show).toHaveBeenLastCalledWith(peekOf("i2")));
  });

  it("writes an opened peek to the URL with replace and keeps its details", async () => {
    const { binding, show } = makeBinding();
    const router = renderRoute("/p1/issues?l=list", binding);
    act(() => {
      expect(getPeekRoute()?.onPeek(peekOf("i1", 2))).toBe(true);
    });
    await waitFor(() => expect(router.state.location.search).toBe("?l=list&peek=WEB-1"));
    expect(router.state.historyAction).toBe("REPLACE");
    await waitFor(() => expect(show).toHaveBeenLastCalledWith(peekOf("i1", 2)));
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

  it("leaves a peek without a URL form to the store", () => {
    const { binding } = makeBinding();
    renderRoute("/p1/issues", binding);
    expect(getPeekRoute()?.onPeek({ ...peekOf("i1"), isArchived: true })).toBe(false);
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
