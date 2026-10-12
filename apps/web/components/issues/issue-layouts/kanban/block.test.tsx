/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TIssue } from "@plane/types";
import { findNestedInteractive } from "@/lib/testing/nested-interactive";
import { KanbanIssueBlock } from "./block";

const handleRedirection = vi.fn();

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "ws" }) }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ getProjectIdentifierById: () => "DEMO" }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({ useIssueDetail: () => ({ getIsIssuePeeked: () => false }) }));
vi.mock("@/hooks/store/use-kanban-view", () => ({ useKanbanView: () => ({ setIsDragging: vi.fn() }) }));
vi.mock("@/hooks/use-issue-peek-overview-redirection", () => ({ default: () => ({ handleRedirection }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/components/core/render-if-visible-HOC", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/issues/issue-detail/issue-identifier", () => ({ IssueIdentifier: () => <span>DEMO-1</span> }));
vi.mock("../properties/all-properties", () => ({
  IssueProperties: () => (
    <div>
      <button type="button">State</button>
    </div>
  ),
}));

const issue: TIssue = {
  id: "i1",
  sequence_id: 1,
  name: "Fix the login page",
  sort_order: 0,
  state_id: null,
  priority: null,
  label_ids: [],
  assignee_ids: [],
  estimate_point: null,
  sub_issues_count: 0,
  attachment_count: 0,
  link_count: 0,
  project_id: "p1",
  parent_id: null,
  cycle_id: null,
  module_ids: null,
  type_id: "t1",
  created_at: "",
  updated_at: "",
  start_date: null,
  target_date: null,
  completed_at: null,
  archived_at: null,
  created_by: "",
  updated_by: "",
  is_draft: false,
};

const renderBlock = () =>
  render(
    <KanbanIssueBlock
      issueId="i1"
      groupId="g1"
      subGroupId="null"
      issuesMap={{ i1: issue }}
      displayProperties={{ key: true }}
      draggableId="i1"
      canDropOverIssue
      canDragIssuesInCurrentGrouping
      updateIssue={undefined}
      quickActions={({ customActionButton }) => customActionButton ?? null}
      canEditProperties={() => true}
      shouldRenderByDefault
    />
  );

describe("KanbanIssueBlock", () => {
  it("renders no nested interactive elements", () => {
    const { container } = renderBlock();
    expect(findNestedInteractive(container)).toEqual([]);
  });

  it("opens the work item from the title link", () => {
    renderBlock();
    const link = screen.getByRole("link", { name: "Fix the login page" });
    expect(link.getAttribute("href")).toBe("/ws/browse/DEMO-1/");
    fireEvent.click(link);
    expect(handleRedirection).toHaveBeenCalledWith("ws", issue, false);
  });
});
