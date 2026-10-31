// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { IIssueActivity, IUserActivityResponse } from "@plane/types";
import { ActivityList } from "./activity-list";

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "ws" }) }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "u1" } }) }));
vi.mock("@/hooks/store/use-workspace", () => ({ useWorkspace: () => ({ getWorkspaceBySlug: () => undefined }) }));
vi.mock("@/components/editor/rich-text", () => ({ RichTextEditor: () => null }));
vi.mock("@/components/core/activity", () => ({
  ActivityIcon: () => null,
  ActivityMessage: () => <span>changed something</span>,
  IssueLink: () => null,
}));

const activity = (overrides: Partial<IIssueActivity>): IIssueActivity => ({
  id: "a1",
  actor_detail: null,
  issue_detail: null,
  project_detail: {
    id: "p1",
    identifier: "P",
    name: "P",
    cover_image: null,
    cover_image_url: null,
    logo_props: {},
    description: "",
  },
  workspace_detail: { id: "w1", name: "W", slug: "ws", logo_url: null },
  source_data: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
  verb: "updated",
  field: "priority",
  old_value: "low",
  new_value: "high",
  comment: "",
  attachments: [],
  old_identifier: null,
  new_identifier: null,
  epoch: null,
  external_source: null,
  external_id: null,
  created_by: null,
  updated_by: null,
  project: "p1",
  workspace: "w1",
  issue: null,
  issue_comment: null,
  actor: null,
  ...overrides,
});

const page = (results: IIssueActivity[]): IUserActivityResponse => ({
  results,
  grouped_by: null,
  sub_grouped_by: null,
  total_count: results.length,
  next_cursor: "",
  prev_cursor: "",
  next_page_results: false,
  prev_page_results: false,
  count: results.length,
  total_pages: 1,
  total_results: results.length,
  extra_stats: null,
});

describe("ActivityList", () => {
  it("renders activity whose actor no longer exists", () => {
    render(<ActivityList activity={page([activity({}), activity({ id: "a2", field: null, verb: "created" })])} />);
    expect(screen.getByText("changed something")).toBeTruthy();
  });
});
