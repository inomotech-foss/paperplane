/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { filtersFromQuery, hasAppliedFilters, splitQueryParam, toggleFilterValue } from "./filter.helper";
import { getGroupIssueIds } from "./grouped-issues.helper";
import { isIssuePriority, isStateGroup } from "./narrow.helper";
import { toPublicState } from "./state.helper";

describe("filter helpers", () => {
  it("toggles a value", () => {
    expect(toggleFilterValue(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleFilterValue(["a", "b"], "a")).toEqual(["b"]);
  });

  it("splits a query param", () => {
    expect(splitQueryParam(undefined)).toEqual([]);
    expect(splitQueryParam("a,,b")).toEqual(["a", "b"]);
  });

  it("builds filters from the query and drops unknown priorities", () => {
    expect(filtersFromQuery({ priority: "high,bogus", state: "s1" })).toEqual({
      priority: ["high"],
      state: ["s1"],
      labels: [],
    });
  });

  it("detects applied filters", () => {
    expect(hasAppliedFilters({ priority: [], state: [], labels: [] })).toBe(false);
    expect(hasAppliedFilters({ labels: ["l1"] })).toBe(true);
    expect(hasAppliedFilters(undefined)).toBe(false);
  });
});

describe("narrowing helpers", () => {
  it("narrows priorities and state groups", () => {
    expect(isIssuePriority("urgent")).toBe(true);
    expect(isIssuePriority("critical")).toBe(false);
    expect(isStateGroup("completed")).toBe(true);
    expect(isStateGroup("done")).toBe(false);
  });

  it("falls back to backlog for an unknown state group", () => {
    const state = { id: "s1", name: "Todo", color: "#000", sequence: 1 };
    expect(toPublicState({ ...state, group: "unstarted" }).group).toBe("unstarted");
    expect(toPublicState({ ...state, group: "other" }).group).toBe("backlog");
  });
});

describe("getGroupIssueIds", () => {
  it("reads grouped and sub grouped ids", () => {
    expect(getGroupIssueIds({ g1: ["i1"] }, "g1")).toEqual(["i1"]);
    expect(getGroupIssueIds({ g1: { s1: ["i2"] } }, "g1", "s1")).toEqual(["i2"]);
  });

  it("returns an empty list for a missing or mismatched group", () => {
    expect(getGroupIssueIds(undefined, "g1")).toEqual([]);
    expect(getGroupIssueIds({ g1: ["i1"] }, "g1", "s1")).toEqual([]);
    expect(getGroupIssueIds({ g1: { s1: ["i2"] } }, "g1")).toEqual([]);
  });
});
