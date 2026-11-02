// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import type { TIssue } from "@plane/types";
import { applyBulkChange, canArchiveAll, getBulkUpdatePayload } from "./bulk-update";

const makeIssue = (id: string, overrides: Partial<TIssue> = {}): TIssue => ({
  id,
  sequence_id: 1,
  name: id,
  sort_order: 0,
  state_id: "s1",
  priority: "none",
  label_ids: ["l1"],
  assignee_ids: ["u1"],
  estimate_point: null,
  sub_issues_count: 0,
  attachment_count: 0,
  link_count: 0,
  project_id: "p1",
  parent_id: null,
  cycle_id: null,
  module_ids: null,
  type_id: "t1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  start_date: "2026-01-05",
  target_date: "2026-01-10",
  completed_at: null,
  archived_at: null,
  created_by: "u1",
  updated_by: "u1",
  is_draft: false,
  ...overrides,
});

describe("getBulkUpdatePayload", () => {
  it("sets single values and skips unchanged ones", () => {
    const issue = makeIssue("a");
    expect(getBulkUpdatePayload(issue, { type: "state", stateId: "s2" })).toEqual({ data: { state_id: "s2" } });
    expect(getBulkUpdatePayload(issue, { type: "state", stateId: "s1" })).toEqual({ skip: "unchanged" });
    expect(getBulkUpdatePayload(issue, { type: "priority", priority: "high" })).toEqual({
      data: { priority: "high" },
    });
  });

  it("adds assignees and labels instead of replacing them", () => {
    const issue = makeIssue("a");
    expect(getBulkUpdatePayload(issue, { type: "assignee", memberId: "u2" })).toEqual({
      data: { assignee_ids: ["u1", "u2"] },
    });
    expect(getBulkUpdatePayload(issue, { type: "label", labelId: "l1" })).toEqual({ skip: "unchanged" });
  });

  it("refuses dates that would end before they start", () => {
    const issue = makeIssue("a");
    expect(getBulkUpdatePayload(issue, { type: "start_date", date: "2026-01-11" })).toEqual({
      skip: "invalid_dates",
    });
    expect(getBulkUpdatePayload(issue, { type: "target_date", date: "2026-01-04" })).toEqual({
      skip: "invalid_dates",
    });
    expect(getBulkUpdatePayload(issue, { type: "target_date", date: null })).toEqual({ data: { target_date: null } });
  });
});

describe("applyBulkChange", () => {
  it("updates each work item that needs it and counts the outcomes", async () => {
    const update = vi.fn(async (issue: TIssue) => {
      if (issue.id === "b") throw new Error("nope");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const issues = [
      makeIssue("a"),
      makeIssue("b"),
      makeIssue("c", { start_date: null, target_date: "2026-01-01" }),
      makeIssue("d", { start_date: "2026-01-02" }),
    ];

    const result = await applyBulkChange(issues, { type: "start_date", date: "2026-01-02" }, update);

    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith(issues[0], { start_date: "2026-01-02" });
    expect(result).toEqual({ updated: 1, failed: 1, invalidDates: 1 });
  });
});

describe("canArchiveAll", () => {
  it("allows only completed and cancelled work items", () => {
    expect(canArchiveAll(["completed", "cancelled"])).toBe(true);
    expect(canArchiveAll(["completed", "started"])).toBe(false);
    expect(canArchiveAll(["completed", undefined])).toBe(false);
    expect(canArchiveAll([])).toBe(false);
  });
});
