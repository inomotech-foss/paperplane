// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { afterEach, describe, expect, it, vi } from "vitest";
import { CoreRootStore } from "@/store/root.store";

const service = vi.hoisted(() => ({ retrieve: vi.fn() }));

// Some stores read the app's root store from here. A fresh root store per test needs no shared one.
vi.mock("@/lib/store-context", () => ({ rootStore: {} }));

vi.mock("@/services/inbox", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/inbox")>();
  return {
    ...original,
    InboxIssueService: class {
      retrieve = service.retrieve;
    },
  };
});

const makeStore = () => {
  const root = new CoreRootStore();
  const pending = () => new Promise<never>(() => {});
  vi.spyOn(root.issue.issueDetail, "fetchReactions").mockImplementation(pending);
  vi.spyOn(root.issue.issueDetail, "fetchActivities").mockImplementation(pending);
  vi.spyOn(root.issue.issueDetail, "fetchComments").mockImplementation(pending);
  vi.spyOn(root.issue.issueDetail, "fetchAttachments").mockImplementation(pending);
  const store = root.projectInbox;
  store.loader = undefined;
  return store;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProjectInboxStore.fetchInboxIssueById", () => {
  it("leaves the list loader alone", async () => {
    service.retrieve.mockResolvedValueOnce({ id: "x", status: -2, issue: { id: "i1" } });
    const store = makeStore();

    const request = store.fetchInboxIssueById("ws", "p1", "x");
    expect(store.loader).toBeUndefined();
    await request;
    expect(store.loader).toBeUndefined();
    expect(store.getIssueInboxByIssueId("i1")).toBeDefined();
  });

  it("answers once the work item is in, without waiting for its activity and comments", async () => {
    service.retrieve.mockResolvedValueOnce({ id: "x", status: -2, issue: { id: "i1" } });
    await expect(makeStore().fetchInboxIssueById("ws", "p1", "x")).resolves.toMatchObject({ id: "x" });
  });

  it("does not leave a loader behind when the response has no work item", async () => {
    service.retrieve.mockResolvedValueOnce({ id: "x", status: -2, issue: {} });
    const store = makeStore();
    await store.fetchInboxIssueById("ws", "p1", "x");
    expect(store.loader).toBeUndefined();
  });
});
