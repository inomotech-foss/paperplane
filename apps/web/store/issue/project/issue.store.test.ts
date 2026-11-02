// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { TIssue, TIssuesResponse } from "@plane/types";
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

const emptyResponse: TIssuesResponse = {
  grouped_by: null,
  next_cursor: "",
  prev_cursor: "",
  next_page_results: false,
  prev_page_results: false,
  total_count: 0,
  count: 0,
  total_pages: 1,
  results: [],
  total_results: 0,
};

const created: TIssue = {
  id: "i1",
  sequence_id: 41,
  name: "New work item",
  sort_order: 0,
  state_id: null,
  priority: null,
  label_ids: [],
  assignee_ids: [],
  estimate_point: null,
  sub_issues_count: 0,
  attachment_count: 0,
  link_count: 0,
  project_id: "project-1",
  parent_id: null,
  cycle_id: null,
  module_ids: null,
  type_id: "t1",
  created_at: "",
  updated_at: "",
  start_date: null,
  target_date: null,
  completed_at: null,
  archived_at: null,
  created_by: "",
  updated_by: "",
  is_draft: false,
};

describe("ProjectIssues parent stats", () => {
  it("does not refetch the project when the list loads", async () => {
    const getProject = vi.spyOn(store.projectRoot.project.projectService, "getProject");
    vi.spyOn(issues.issueService, "getIssues").mockResolvedValue(emptyResponse);

    await issues.fetchIssues("ws", "project-1", "init-loader", options);

    expect(getProject).not.toHaveBeenCalled();
  });

  it("moves the next sequence of the project past a created work item", async () => {
    const getProject = vi.spyOn(store.projectRoot.project.projectService, "getProject");
    vi.spyOn(issues.issueService, "createIssue").mockResolvedValue(created);
    vi.spyOn(store.issueType, "rememberIssueType").mockResolvedValue(undefined);

    await issues.createIssue("ws", "project-1", { name: created.name });

    expect(store.projectRoot.project.projectMap["project-1"]?.next_work_item_sequence).toBe(42);
    expect(getProject).not.toHaveBeenCalled();
  });
});
