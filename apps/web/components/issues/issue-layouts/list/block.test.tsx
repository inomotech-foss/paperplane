/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TIssue } from "@plane/types";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
import { findNestedInteractive } from "@/lib/testing/nested-interactive";
import { IssueBlock } from "./block";

const setPeekIssue = vi.fn();
const fetchSubIssues = vi.fn();

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "ws", projectId: "p1" }) }));
vi.mock("@/hooks/store/use-app-theme", () => ({ useAppTheme: () => ({ sidebarCollapsed: false }) }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectIdentifierById: () => "DEMO", currentProjectNextSequenceId: 10 }),
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    getIsIssuePeeked: () => false,
    peekIssue: undefined,
    setPeekIssue,
    subIssues: { fetchSubIssues },
  }),
}));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/components/issues/issue-detail/issue-identifier", () => ({ IssueIdentifier: () => <span>DEMO-1</span> }));
vi.mock("@/components/issues/issue-layouts/properties", () => ({
  IssueProperties: () => (
    <div>
      <button type="button">State</button>
    </div>
  ),
}));
vi.mock("@/components/core/multiple-select", () => ({
  MultipleSelectEntityAction: () => <input type="checkbox" aria-label="Select" />,
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
  sub_issues_count: 2,
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

const selectionHelpers: TSelectionHelper = {
  handleClearSelection: vi.fn(),
  handleEntityClick: vi.fn(),
  getIsEntitySelected: () => false,
  getIsEntityActive: () => false,
  handleGroupClick: vi.fn(),
  isGroupSelected: () => "empty",
  isSelectionDisabled: false,
};

const renderBlock = (setExpanded = vi.fn()) =>
  render(
    <IssueBlock
      issueId="i1"
      issuesMap={{ i1: issue }}
      groupId="g1"
      updateIssue={undefined}
      quickActions={() => <button type="button">Quick actions</button>}
      displayProperties={{ key: true }}
      canEditProperties={() => true}
      nestingLevel={0}
      isExpanded={false}
      setExpanded={setExpanded}
      selectionHelpers={selectionHelpers}
      isCurrentBlockDragging={false}
      setIsCurrentBlockDragging={vi.fn()}
      canDrag
    />
  );

describe("IssueBlock", () => {
  it("renders no nested interactive elements", () => {
    const { container } = renderBlock();
    expect(findNestedInteractive(container)).toEqual([]);
  });

  it("opens the peek view from the title link", () => {
    renderBlock();
    const link = screen.getByRole("link", { name: "Fix the login page" });
    expect(link.id).toBe("issue-i1");
    fireEvent.click(link);
    expect(setPeekIssue).toHaveBeenCalledWith(expect.objectContaining({ issueId: "i1" }));
  });

  it("expands sub-work items without opening the peek view", () => {
    setPeekIssue.mockClear();
    const setExpanded = vi.fn();
    const { container } = renderBlock(setExpanded);
    const chevron = container.querySelector("button.rounded-xs");
    expect(chevron).not.toBeNull();
    if (chevron) fireEvent.click(chevron);
    expect(setExpanded).toHaveBeenCalled();
    expect(setPeekIssue).not.toHaveBeenCalled();
  });
});
