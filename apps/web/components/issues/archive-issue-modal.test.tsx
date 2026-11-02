// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArchiveIssueModal } from "./archive-issue-modal";

vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: () => ({ identifier: "LOAD" }) }),
}));
vi.mock("@/hooks/store/use-issues", () => ({
  useIssues: () => ({ issueMap: { i1: { id: "i1", project_id: "p1", sequence_id: 18 } } }),
}));

describe("ArchiveIssueModal", () => {
  it("names the work item by its key", () => {
    render(<ArchiveIssueModal dataId="i1" isOpen handleClose={vi.fn()} />);
    expect(screen.getByText(/LOAD-18/)).toBeTruthy();
  });
});
