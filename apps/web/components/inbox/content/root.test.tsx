// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WEB_SWR_CONFIG } from "@/lib/swr-config";
import { InboxContentRoot } from "./root";

const inbox = vi.hoisted(() => {
  const state: { listedIssue: unknown } = { listedIssue: { status: -2, issue: { id: "i1", created_by: "u1" } } };
  return { state, fetchInboxIssueById: vi.fn() };
});

vi.mock("@/hooks/store/use-project-inbox", () => ({
  useProjectInbox: () => ({
    currentTab: "open",
    // the list is still loading while the detail view opens
    loader: "init-loading",
    fetchInboxIssueById: inbox.fetchInboxIssueById,
    getIssueInboxByIssueId: () => inbox.state.listedIssue,
    getIsIssueAvailable: () => true,
  }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "u1" } }),
  useUserPermissions: () => ({
    allowPermissions: () => true,
    getProjectRoleByWorkspaceSlugAndProjectId: () => undefined,
  }),
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ replace: vi.fn() }) }));
vi.mock("./inbox-issue-header", () => ({ InboxIssueActionsHeader: () => null }));
vi.mock("./issue-root", () => ({
  InboxIssueMainContent: ({ isLoading }: { isLoading: boolean }) => (
    <div data-testid="content" data-loading={String(isLoading)} />
  ),
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

const renderRoot = () =>
  render(
    <InboxContentRoot
      workspaceSlug="ws"
      projectId="p1"
      inboxIssueId="i1"
      isMobileSidebar={false}
      setIsMobileSidebar={() => {}}
    />,
    { wrapper: Wrapper }
  );

afterEach(() => {
  inbox.state.listedIssue = { status: -2, issue: { id: "i1", created_by: "u1" } };
  vi.clearAllMocks();
});

describe("InboxContentRoot", () => {
  it("tracks the detail load on its own, apart from the list loader", async () => {
    let resolve: (value: unknown) => void = () => {};
    inbox.fetchInboxIssueById.mockReturnValueOnce(new Promise((res) => (resolve = res)));
    renderRoot();

    expect(screen.getByTestId("content").dataset.loading).toBe("true");
    await act(async () => resolve({ id: "x", issue: { id: "i1" } }));
    await waitFor(() => expect(screen.getByTestId("content").dataset.loading).toBe("false"));
  });

  it("stops loading when the response has no work item", async () => {
    inbox.fetchInboxIssueById.mockResolvedValueOnce({ id: "x", issue: {} });
    renderRoot();

    await waitFor(() => expect(screen.getByTestId("content").dataset.loading).toBe("false"));
  });

  it("shows a retry when the work item is not listed and the fetch fails", async () => {
    inbox.state.listedIssue = undefined;
    inbox.fetchInboxIssueById.mockRejectedValueOnce(new StatusError(404));
    renderRoot();

    expect(await screen.findByRole("button")).toBeTruthy();
  });
});
