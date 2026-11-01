// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { ApiSchema } from "@plane/api-types";
import {
  toBaseIssue,
  toIssueCreateBody,
  toIssueLink,
  toIssuePriority,
  toIssueRelations,
  toIssuesResponse,
  toIssueWriteBody,
  toLinkMetadata,
  toRelatedIssue,
  toWorkItemById,
} from "./work-item";

const row: ApiSchema<"WorkItemListItem"> = {
  id: "i1",
  name: "Item",
  state_id: null,
  sort_order: 1,
  completed_at: null,
  estimate_point: null,
  priority: "high",
  start_date: null,
  target_date: null,
  sequence_id: 3,
  project_id: "p1",
  parent_id: null,
  type_id: "t1",
  cycle_id: null,
  sub_issues_count: null,
  created_at: "c",
  updated_at: "u",
  created_by: null,
  updated_by: null,
  attachment_count: null,
  link_count: null,
  is_draft: false,
  archived_at: null,
  state__group: "started",
};

const page = { grouped_by: null, sub_grouped_by: null, total_count: 1, next_cursor: "n", prev_cursor: "p" };
const counts = { next_page_results: false, prev_page_results: false, count: 1, total_pages: 1, total_results: 1 };

describe("toBaseIssue", () => {
  it("leaves out the columns the row does not send, so the store keeps what it holds", () => {
    const issue = toBaseIssue(row);
    expect(issue).toMatchObject({ priority: "high", cycle_id: null, sub_issues_count: 0, link_count: 0 });
    for (const column of ["label_ids", "assignee_ids", "module_ids"]) expect(issue).not.toHaveProperty(column);
    expect(toIssuePriority("bogus")).toBeNull();
  });
});

describe("toWorkItemById", () => {
  it("keeps the user id when created_by or updated_by is expanded", () => {
    const user = {
      id: "u1",
      first_name: "A",
      last_name: "B",
      avatar: "",
      avatar_url: null,
      is_bot: false,
      display_name: "ab",
    };
    const expanded: ApiSchema<"ExpandedWorkItem"> = { ...row, priority: "high", created_by: user, updated_by: "u2" };
    expect(toWorkItemById(expanded)).toMatchObject({ created_by: "u1", updated_by: "u2" });
  });
});

describe("toIssueRelations", () => {
  const relation = {
    id: "r1",
    project_id: "p1",
    sequence_id: 2,
    name: "R",
    state_id: null,
    priority: "none",
    created_by: null,
    created_at: "c",
    updated_at: "u",
    updated_by: null,
  };

  it("keeps the expanded relations and skips unknown relation types", () => {
    expect(
      toIssueRelations([
        { ...relation, relation_type: "blocked_by" },
        { ...relation, id: "r2", relation_type: "start_before" },
      ])
    ).toEqual([{ id: "r1", name: "R", project_id: "p1", sequence_id: 2, relation_type: "blocked_by" }]);
  });
});

describe("toIssuesResponse", () => {
  it("converts flat, grouped and sub-grouped pages", () => {
    const flat = toIssuesResponse({ ...page, ...counts, results: [row], extra_stats: null });
    expect(Array.isArray(flat.results) && flat.results[0]).toMatchObject({ id: "i1", state__group: "started" });

    const grouped = toIssuesResponse({
      ...page,
      ...counts,
      grouped_by: "priority",
      results: { high: { results: [row], total_results: null } },
      extra_stats: null,
    });
    expect(grouped.results).toMatchObject({ high: { total_results: 0, results: [{ id: "i1" }] } });

    const subGrouped = toIssuesResponse({
      ...page,
      ...counts,
      grouped_by: "priority",
      sub_grouped_by: "state_id",
      results: { high: { results: { s1: { results: [row], total_results: 1 } }, total_results: 1 } },
      extra_stats: null,
    });
    expect(subGrouped.results).toMatchObject({ high: { results: { s1: { results: [{ id: "i1" }] } } } });
  });
});

describe("links", () => {
  it("names the issue and creator the same for both link shapes", () => {
    const lite = toIssueLink({
      id: "l1",
      issue_id: "i1",
      title: null,
      url: "https://a",
      metadata: { title: "A", favicon: 3 },
      created_by_id: "u1",
      created_at: "c",
    });
    expect(lite).toMatchObject({ issue_id: "i1", created_by_id: "u1", metadata: { title: "A" } });
    expect(lite.metadata).not.toHaveProperty("favicon");
    expect(toLinkMetadata("x")).toEqual({});
  });
});

describe("toRelatedIssue", () => {
  it("keeps only the fields a relation row carries", () => {
    const related = toRelatedIssue({
      id: "i2",
      project_id: "p1",
      sequence_id: 4,
      relation_type: "blocked_by",
      name: "B",
      priority: "none",
      created_by: null,
      created_at: "c",
      updated_at: "u",
      updated_by: null,
    });
    expect(related).toMatchObject({ id: "i2", priority: "none" });
    expect(related).not.toHaveProperty("label_ids");
  });
});

describe("write bodies", () => {
  it("keeps writable fields and the skip_activity flag the editors send as a string", () => {
    const data = { name: "N", cycle_id: "c1", priority: "low" as const, skip_activity: "true" };
    expect(toIssueWriteBody(data)).toEqual({ name: "N", priority: "low", skip_activity: true });
  });

  it("requires a type on create", () => {
    expect(() => toIssueCreateBody({ name: "N" })).toThrow();
    const withFlag = { type_id: "t1", skip_activity: true };
    expect(toIssueCreateBody(withFlag)).toEqual({ name: "", type_id: "t1" });
  });
});
