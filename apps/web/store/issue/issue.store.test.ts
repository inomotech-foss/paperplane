// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { TIssue, TProject } from "@plane/types";
import { store } from "@/lib/store-context";
import { emptyIssue } from "./issue.store";

const project = (id: string, nextSequence: number): TProject => ({
  id,
  name: id,
  identifier: id.toUpperCase(),
  sort_order: null,
  logo_props: { in_use: "emoji" },
  archived_at: null,
  workspace: "w1",
  cycle_view: false,
  issue_views_view: false,
  module_view: false,
  page_view: false,
  issue_view: true,
  inbox_view: false,
  next_work_item_sequence: nextSequence,
});

const workItem = (id: string, projectId: string, sequenceId: number): TIssue => ({
  ...emptyIssue(id),
  project_id: projectId,
  sequence_id: sequenceId,
});

const nextSequence = (projectId: string) => store.projectRoot.project.projectMap[projectId]?.next_work_item_sequence;

describe("IssueStore next work item sequence", () => {
  it("moves the next sequence of the project past a loaded work item", () => {
    store.projectRoot.project.processProjectAfterCreation("ws", project("seq-a", 10));

    store.issue.issues.addIssue([workItem("a1", "seq-a", 999), workItem("a2", "seq-a", 5)]);

    expect(nextSequence("seq-a")).toBe(1000);
  });

  it("keeps the next sequence when the work item is below it", () => {
    store.projectRoot.project.processProjectAfterCreation("ws", project("seq-b", 10));

    store.issue.issues.mergeIssue(workItem("b1", "seq-b", 9));

    expect(nextSequence("seq-b")).toBe(10);
  });

  it("does not create a project that is not loaded", () => {
    store.issue.issues.mergeIssue(workItem("c1", "seq-c", 7));
    store.projectRoot.project.setProjectNextSequence("seq-c", 8);

    expect(store.projectRoot.project.projectMap["seq-c"]).toBeUndefined();
  });
});
