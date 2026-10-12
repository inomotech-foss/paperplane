/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EIssueServiceType } from "@plane/types";
import { findNestedInteractive } from "@/lib/testing/nested-interactive";
import { IssueDetailWidgetActionButtons } from "./action-buttons";

const toggleIssueLinkModal = vi.fn();

vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    issue: { getIssueById: () => ({ id: "i1" }) },
    toggleCreateIssueModal: vi.fn(),
    toggleSubIssuesModal: vi.fn(),
    setIssueCrudOperationState: vi.fn(),
    issueCrudOperationState: {},
    toggleRelationModal: vi.fn(),
    setRelationKey: vi.fn(),
    toggleIssueLinkModal,
    setLastWidgetAction: vi.fn(),
    fetchActivities: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-file-size", () => ({ useFileSize: () => ({ maxFileSize: 1024 }) }));
vi.mock("@/components/relations", () => ({ useTimeLineRelationOptions: () => ({}) }));
vi.mock("./attachments/helper", () => ({ useAttachmentOperations: () => ({ operations: { create: vi.fn() } }) }));

describe("IssueDetailWidgetActionButtons", () => {
  it("renders each widget button as its own trigger", () => {
    const { container } = render(
      <IssueDetailWidgetActionButtons
        workspaceSlug="ws"
        projectId="p1"
        issueId="i1"
        disabled={false}
        issueServiceType={EIssueServiceType.ISSUES}
      />
    );
    expect(findNestedInteractive(container)).toEqual([]);
    expect(container.querySelectorAll("button")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /attach/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /link/i }));
    expect(toggleIssueLinkModal).toHaveBeenCalledWith(true);
  });
});
