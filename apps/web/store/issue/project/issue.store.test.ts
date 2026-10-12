// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { TIssuesResponse } from "@plane/types";
import { store } from "@/lib/store-context";
import { ProjectIssues } from "./issue.store";

const issues = new ProjectIssues(store.issue, store.issue.projectIssuesFilter);
const options = { canGroup: false, perPageCount: 100 };

// a request that stays pending until the store aborts it
const pendingUntilAborted = () => {
  const { signal } = issues.controller;
  return new Promise<TIssuesResponse>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason));
  });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProjectIssues.fetchIssues", () => {
  it("settles a fetch quietly when a newer fetch aborts it", async () => {
    const error = new Error("server error");
    vi.spyOn(issues.issueService, "getIssues").mockImplementationOnce(pendingUntilAborted).mockRejectedValueOnce(error);

    const first = issues.fetchIssues("ws", "project-1", "init-loader", options);
    const second = issues.fetchIssues("ws", "project-1", "mutation", options);

    await expect(first).resolves.toBeUndefined();
    await expect(second).rejects.toBe(error);
    expect(issues.getIssueLoader()).toBeUndefined();
  });

  it("keeps the loader of the newer fetch", async () => {
    vi.spyOn(issues.issueService, "getIssues")
      .mockImplementationOnce(pendingUntilAborted)
      .mockImplementationOnce(pendingUntilAborted);

    const first = issues.fetchIssues("ws", "project-1", "init-loader", options);
    void issues.fetchIssues("ws", "project-1", "mutation", options);

    await expect(first).resolves.toBeUndefined();
    expect(issues.getIssueLoader()).toBe("mutation");
    issues.clear();
  });
});
