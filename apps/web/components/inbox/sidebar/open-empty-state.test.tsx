// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InboxSidebarOpenEmptyState } from "./open-empty-state";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/empty-state", () => ({
  EmptyStateDetailed: ({ actions }: { actions: { label: string; onClick: () => void }[] }) => (
    <>
      {actions.map((action) => (
        <button key={action.label} type="button" onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </>
  ),
}));
vi.mock("../modals/create-modal", () => ({
  InboxIssueCreateModalRoot: ({
    modalState,
    handleModalClose,
  }: {
    modalState: boolean;
    handleModalClose: () => void;
  }) =>
    modalState ? (
      <div role="dialog">
        <button type="button" onClick={handleModalClose}>
          close
        </button>
      </div>
    ) : null,
}));

describe("InboxSidebarOpenEmptyState", () => {
  it("opens the create intake modal from its call to action", () => {
    render(<InboxSidebarOpenEmptyState workspaceSlug="w" projectId="p" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "project_empty_state.intake_sidebar.cta_primary" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
