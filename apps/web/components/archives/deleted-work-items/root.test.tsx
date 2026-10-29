// SPDX-License-Identifier: AGPL-3.0-only

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@plane/services";
import { DeletedWorkItemsRoot } from "./root";

const { restore, setToast } = vi.hoisted(() => ({ restore: vi.fn(), setToast: vi.fn() }));

vi.mock("@/services/issue/issue-trash.service", () => ({
  IssueTrashService: class {
    list = async () => ({
      results: [{ id: "i1", name: "Item", project_identifier: "NOVA", sequence_id: 1, purge_at: "2026-11-01" }],
      next_page_results: false,
    });
    restore = restore;
    purge = vi.fn();
  },
}));
vi.mock("@plane/blocks/toast", () => ({ setToast }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => false }) }));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: () => undefined }) }));

const restoreFirstItem = async () => {
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DeletedWorkItemsRoot workspaceSlug="ws" projectId="p1" />
    </SWRConfig>
  );
  fireEvent.click(await screen.findByRole("button", { name: "issue.trash.restore" }));
  await waitFor(() => expect(setToast).toHaveBeenCalled());
};

describe("DeletedWorkItemsRoot", () => {
  beforeEach(() => {
    restore.mockReset();
    setToast.mockReset();
  });

  it("shows the reason the server gives for a failed restore", async () => {
    const reason = "Another work item has the same number";
    restore.mockRejectedValue(new ApiError(new Response(null, { status: 409 }), { error: reason }));

    await restoreFirstItem();

    expect(setToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error", message: reason }));
  });

  it("falls back to a generic message for other errors", async () => {
    restore.mockRejectedValue(new Error("network"));

    await restoreFirstItem();

    expect(setToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", message: "issue.trash.restore_failed" })
    );
  });
});
