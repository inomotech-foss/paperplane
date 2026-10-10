// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { TIssueType } from "@plane/types";
import type { TIssueTypeUsage } from "@/services/issue/issue-type-removal.service";
import { DeleteIssueTypeModal } from "./delete-modal";

const usage = vi.hoisted(() => ({ current: undefined as TIssueTypeUsage | undefined }));
const deleteIssueType = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "dev", projectId: "p1" }) }));

vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: { count?: number }) => (params?.count === undefined ? key : `${key}:${params.count}`),
  }),
}));

vi.mock("@/services/issue/issue-type-removal.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/issue/issue-type-removal.service")>();
  return {
    ...original,
    IssueTypeRemovalService: class {
      getUsage = () => Promise.resolve(usage.current);
    },
  };
});

const makeType = (id: string): TIssueType => ({
  id,
  name: id,
  description: "",
  logo_props: { in_use: "icon" },
  is_epic: false,
  is_active: true,
  level: 0,
  project: "p1",
  workspace: "ws",
});

vi.mock("@/hooks/store/use-issue-types", () => ({
  useIssueTypes: () => ({
    deleteIssueType,
    getActiveProjectIssueTypes: () => [makeType("story"), makeType("bug")],
    getIssueTypeById: () => null,
  }),
}));

const makeUsage = (fields: Partial<TIssueTypeUsage>): TIssueTypeUsage => ({
  work_items: 0,
  deleted_work_items: 0,
  drafts: 0,
  intakes: 0,
  automation_actions: 0,
  ...fields,
});

const renderDialog = () =>
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DeleteIssueTypeModal isOpen issueType={makeType("story")} onClose={vi.fn()} />
    </SWRConfig>
  );

const deleteButton = () => screen.getByRole("button", { name: "delete" });
const isDisabled = (element: HTMLElement) =>
  element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
const picker = () => screen.queryByText("work_item_types.settings.item_delete_confirmation.replacement_label");

describe("DeleteIssueTypeModal", () => {
  beforeEach(() => {
    deleteIssueType.mockReset();
  });

  it("asks a plain confirmation when nothing uses the type", async () => {
    usage.current = makeUsage({});
    renderDialog();

    await waitFor(() => expect(isDisabled(deleteButton())).toBe(false));
    expect(screen.getByText("work_item_types.settings.item_delete_confirmation.description")).not.toBeNull();
    expect(picker()).toBeNull();

    deleteButton().click();
    await waitFor(() => expect(deleteIssueType).toHaveBeenCalledWith("dev", "p1", "story", undefined));
  });

  it("asks for a replacement when work items use the type", async () => {
    usage.current = makeUsage({ work_items: 3, deleted_work_items: 1 });
    renderDialog();

    await waitFor(() => expect(picker()).not.toBeNull());
    expect(
      screen.getByText(
        "work_item_types.settings.item_delete_confirmation.in_use:3 work_item_types.settings.item_delete_confirmation.deleted_too"
      )
    ).not.toBeNull();
    expect(isDisabled(deleteButton())).toBe(true);
  });

  it("explains why when only deleted work items use the type", async () => {
    usage.current = makeUsage({ deleted_work_items: 2 });
    renderDialog();

    await waitFor(() => expect(picker()).not.toBeNull());
    expect(screen.getByText("work_item_types.settings.item_delete_confirmation.only_hidden")).not.toBeNull();
    expect(screen.queryByText(/in_use/)).toBeNull();
    expect(isDisabled(deleteButton())).toBe(true);
  });
});
