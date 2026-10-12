/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IssueAttachmentItemList } from "./attachment-item-list";

vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    attachment: { getAttachmentsByIssueId: () => ["a1"] },
    attachmentDeleteModalId: null,
    toggleDeleteAttachmentModal: vi.fn(),
    fetchActivities: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-file-size", () => ({ useFileSize: () => ({ maxFileSize: 1024 }) }));
vi.mock("./attachment-list-item", () => ({
  IssueAttachmentsListItem: () => (
    <div>
      <a href="#report">report.pdf</a>
      <button type="button">More</button>
    </div>
  ),
}));

const attachmentHelpers = {
  operations: { create: vi.fn(() => Promise.resolve()), remove: vi.fn(() => Promise.resolve()) },
  snapshot: { uploadStatus: undefined },
};

describe("IssueAttachmentItemList", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not open the file picker from an attachment row", () => {
    const openPicker = vi.spyOn(HTMLInputElement.prototype, "click");
    render(
      <IssueAttachmentItemList workspaceSlug="ws" projectId="p1" issueId="i1" attachmentHelpers={attachmentHelpers} />
    );
    fireEvent.click(screen.getByRole("link", { name: "report.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.keyDown(screen.getByRole("link", { name: "report.pdf" }), { key: "Enter" });
    expect(openPicker).not.toHaveBeenCalled();
  });
});
