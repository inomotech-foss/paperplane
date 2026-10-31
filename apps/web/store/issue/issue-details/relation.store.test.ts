// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import { IssueRelationStore } from "./relation.store";

const deleteIssueRelation = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("@/services/issue", () => ({
  IssueRelationService: class {
    deleteIssueRelation = deleteIssueRelation;
  },
}));

const root = {
  peekIssue: undefined,
  issue: { getIssueById: vi.fn(() => undefined) },
  activity: { fetchActivities: vi.fn(() => Promise.resolve([])) },
  rootIssueStore: { workspaceSlug: "ws", issues: { addPartialIssues: vi.fn() } },
};

describe("removing a relation", () => {
  it("removes the reverse relation of the related work item, not its last one", async () => {
    const store = new IssueRelationStore(root);
    store.relationMap = {
      a: { blocking: ["b"], blocked_by: [], duplicate: [], relates_to: [] },
      b: { blocking: [], blocked_by: ["a", "c"], duplicate: [], relates_to: [] },
    };

    await store.removeRelation("ws", "p1", "a", "blocking", "b");

    expect(store.relationMap.a?.blocking).toEqual([]);
    expect(store.relationMap.b?.blocked_by).toEqual(["c"]);
  });

  it("sends the relation type, which the activity log names", async () => {
    const store = new IssueRelationStore(root);
    store.relationMap = { a: { blocking: [], blocked_by: ["b"], duplicate: [], relates_to: [] } };

    await store.removeRelation("ws", "p1", "a", "blocked_by", "b");

    expect(deleteIssueRelation).toHaveBeenCalledWith("ws", "p1", "a", "blocked_by", "b");
  });
});
