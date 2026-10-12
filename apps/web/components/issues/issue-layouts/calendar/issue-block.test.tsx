// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { TIssue } from "@plane/types";
import { findNestedInteractive } from "@/lib/testing/nested-interactive";
import { CalendarIssueBlock } from "./issue-block";

const issue: TIssue = {
  id: "issue-1",
  sequence_id: 1,
  name: "Calendar work item",
  sort_order: 0,
  state_id: null,
  priority: null,
  label_ids: [],
  assignee_ids: [],
  estimate_point: null,
  sub_issues_count: 0,
  attachment_count: 0,
  link_count: 0,
  project_id: "project-1",
  parent_id: null,
  cycle_id: null,
  module_ids: null,
  type_id: "type-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  start_date: null,
  target_date: "2026-01-02",
  completed_at: null,
  archived_at: null,
  created_by: "user-1",
  updated_by: "user-1",
  is_draft: false,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CalendarIssueBlock", () => {
  it("renders the link as the preview trigger without a console error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { container } = render(
      <MemoryRouter>
        <CalendarIssueBlock issue={issue} quickActions={() => <button type="button">More</button>} />
      </MemoryRouter>
    );

    expect(errorSpy).not.toHaveBeenCalled();
    expect(container.querySelector("a#issue-issue-1")?.getAttribute("role")).not.toBe("button");
    expect(findNestedInteractive(container)).toEqual([]);
    expect(container.querySelector("#calendar-issue-issue-1[data-issue-row='issue-1']")).not.toBeNull();
  });
});
