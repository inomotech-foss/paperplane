// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import { EInboxIssueStatus } from "@plane/types";
import { countAppliedInboxFilters, inboxIssueQuery } from "./inbox-query";
import { revertIssueFields } from "./inbox-issue.store";

describe("inboxIssueQuery", () => {
  it("joins the filter values and sorts by the newest work item when no sorting is set", () => {
    const query = inboxIssueQuery(
      { status: [EInboxIssueStatus.PENDING, EInboxIssueStatus.SNOOZED], priority: ["high"], labels: [] },
      {},
      10,
      "10:0:0"
    );
    expect(query).toEqual({
      status: "-2,0",
      priority: "high",
      order_by: "-issue__created_at",
      per_page: 10,
      cursor: "10:0:0",
    });
  });

  it("orders ascending or descending", () => {
    expect(inboxIssueQuery({}, { order_by: "issue__sequence_id", sort_by: "asc" }, 5, "c").order_by).toBe(
      "issue__sequence_id"
    );
    expect(inboxIssueQuery({}, { order_by: "issue__updated_at", sort_by: "desc" }, 5, "c").order_by).toBe(
      "-issue__updated_at"
    );
  });

  it("turns past durations into a range and keeps custom ranges", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 31, 12));
    const query = inboxIssueQuery({ created_at: ["today", "2026-01-01;after", "2026-02-01;before"] }, {}, 5, "c");
    vi.useRealTimers();
    expect(query.created_at).toBe("2026-10-31;after,2026-10-31;before,2026-01-01;after,2026-02-01;before");
  });
});

describe("countAppliedInboxFilters", () => {
  it("counts every selected value", () => {
    expect(
      countAppliedInboxFilters({ status: [EInboxIssueStatus.PENDING], labels: ["a", "b"], state: undefined })
    ).toBe(3);
  });
});

describe("revertIssueFields", () => {
  it("resets only the changed fields", () => {
    expect(
      revertIssueFields(
        { id: "i", name: "new", priority: "high" },
        { id: "i", name: "old" },
        { name: "new", priority: "high" }
      )
    ).toEqual({
      id: "i",
      name: "old",
    });
  });
});
