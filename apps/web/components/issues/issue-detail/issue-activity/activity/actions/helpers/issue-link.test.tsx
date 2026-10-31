/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IssueLink } from "./issue-link";

const deletedItemActivity = {
  workspace_detail: { slug: "ws" },
  project: "p1",
  issue: null,
  project_detail: { identifier: "PRJ" },
  issue_detail: null,
};

vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ activity: { getActivityById: () => deletedItemActivity } }),
}));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));

describe("IssueLink", () => {
  it("renders the activity of a deleted work item", () => {
    render(<IssueLink activityId="a1" />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("#");
  });
});
