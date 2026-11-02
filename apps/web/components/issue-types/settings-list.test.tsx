// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectSettingsIssueTypesList } from "./settings-list";

const query = vi.hoisted(() => {
  const state: { isLoading: boolean; error: unknown } = { isLoading: false, error: undefined };
  return { state, retry: vi.fn() };
});

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "ws", projectId: "p1" }) }));
vi.mock("@/hooks/use-preselected-issue-type", () => ({
  useProjectIssueTypes: () => ({ ...query.state, retry: query.retry, ensureLoaded: vi.fn() }),
}));
vi.mock("@/hooks/store/use-issue-types", () => ({
  useIssueTypes: () => ({ getProjectIssueTypes: () => [], createIssueType: vi.fn(), updateIssueType: vi.fn() }),
}));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => false }) }));
vi.mock("./delete-modal", () => ({ DeleteIssueTypeModal: () => null }));
vi.mock("./type-item", () => ({ IssueTypeItem: () => null }));

afterEach(() => {
  query.state = { isLoading: false, error: undefined };
  vi.clearAllMocks();
});

describe("ProjectSettingsIssueTypesList", () => {
  it("shows a retry instead of a skeleton when the types fail to load", () => {
    query.state = { isLoading: false, error: new Error("boom") };
    render(<ProjectSettingsIssueTypesList />);
    fireEvent.click(screen.getByRole("button"));
    expect(query.retry).toHaveBeenCalledOnce();
  });

  it("shows the empty text once an empty list arrived", () => {
    const { container } = render(<ProjectSettingsIssueTypesList />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(container.querySelector("p")).not.toBeNull();
  });
});
