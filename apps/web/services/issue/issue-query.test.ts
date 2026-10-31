// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { toIssueListQuery, toIssueSearchQuery, wantsRelations } from "./issue-query";

describe("toIssueListQuery", () => {
  it("converts the store params to the documented query", () => {
    expect(
      toIssueListQuery({
        group_by: "priority",
        sub_group_by: "bogus",
        per_page: "50",
        sub_issue: "false",
        state: "s1,s2",
        show_empty_groups: true,
      })
    ).toEqual({ group_by: "priority", per_page: 50, sub_issue: false, state: "s1,s2" });
    expect(toIssueListQuery(undefined)).toEqual({});
  });

  it("uses the detail endpoint only for ungrouped relation lists", () => {
    expect(wantsRelations({ expand: "issue_relation,issue_related" })).toBe(true);
    expect(wantsRelations({ expand: "issue_relation", group_by: "priority" })).toBe(false);
  });
});

describe("toIssueSearchQuery", () => {
  it("sends the flags as the strings true and false", () => {
    expect(toIssueSearchQuery({ search: "x", workspace_search: false, parent: true })).toMatchObject({
      search: "x",
      workspace_search: "false",
      parent: "true",
      cycle: undefined,
    });
  });
});
