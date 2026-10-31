// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { TApiIssueActivity, TApiIssueComment } from "./work-item-history";
import { isHistoryActivity, isHistoryComment } from "./work-item-history";

const base = {
  actor_detail: null,
  project_detail: {
    id: "p1",
    identifier: "P",
    name: "P",
    cover_image: null,
    cover_image_url: null,
    logo_props: {},
    description: "",
  },
  workspace_detail: { id: "w1", name: "W", slug: "w", logo_url: null },
  created_at: "2026-10-31T00:00:00Z",
  updated_at: "2026-10-31T00:00:00Z",
  deleted_at: null,
  attachments: [],
  external_source: null,
  external_id: null,
  created_by: null,
  updated_by: null,
  project: "p1",
  workspace: "w1",
  actor: null,
};

const activity: TApiIssueActivity = {
  ...base,
  id: "a1",
  issue_detail: null,
  source_data: null,
  verb: "updated",
  field: "priority",
  old_value: "low",
  new_value: "high",
  comment: "",
  old_identifier: null,
  new_identifier: null,
  epoch: null,
  issue: "i1",
  issue_comment: null,
};

const comment: TApiIssueComment = {
  ...base,
  id: "c1",
  issue_detail: {
    id: "i1",
    sequence_id: 1,
    sort_order: 0,
    name: "I",
    description_html: "",
    priority: "none",
    start_date: null,
    target_date: null,
    is_draft: false,
    description_json: {},
  },
  comment_reactions: [],
  comment_stripped: "hi",
  comment_json: {},
  comment_html: "<p>hi</p>",
  access: "INTERNAL",
  edited_at: null,
  description: null,
  issue: "i1",
  parent: null,
};

describe("work item history guards", () => {
  it("tells comments and activities apart", () => {
    const entries = [activity, comment];
    expect(entries.filter(isHistoryComment).map((entry) => entry.id)).toEqual(["c1"]);
    expect(entries.filter(isHistoryActivity).map((entry) => entry.id)).toEqual(["a1"]);
  });
});
