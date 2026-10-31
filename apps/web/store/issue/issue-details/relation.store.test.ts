// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import type { IIssueDetail } from "./root.store";
import { IssueRelationStore } from "./relation.store";

vi.mock("@/services/issue", () => ({
  IssueRelationService: class {
    deleteIssueRelation = vi.fn(() => Promise.resolve());
  },
}));

const root = { activity: { fetchActivities: vi.fn(() => Promise.resolve([])) } };

describe("removing a relation", () => {
  it("removes the reverse relation of the related work item, not its last one", async () => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const store = new IssueRelationStore(root as unknown as IIssueDetail);
    store.relationMap = {
      a: { blocking: ["b"], blocked_by: [], duplicate: [], relates_to: [] },
      b: { blocking: [], blocked_by: ["a", "c"], duplicate: [], relates_to: [] },
    };

    await store.removeRelation("ws", "p1", "a", "blocking", "b");

    expect(store.relationMap.a?.blocking).toEqual([]);
    expect(store.relationMap.b?.blocked_by).toEqual(["c"]);
  });
});
