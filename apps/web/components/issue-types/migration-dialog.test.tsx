// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { TIssueType } from "@plane/types";
import type { TTypeMigrationPreview, TTypeMigrationScope } from "@/services/issue/issue-type-migration.service";
import { IssueTypeMigrationDialog } from "./migration-dialog";

const preview = vi.hoisted(() => ({ current: undefined as TTypeMigrationPreview | undefined }));
const deleteIssueType = vi.hoisted(() => vi.fn());
const migrateIssueType = vi.hoisted(() => vi.fn());

vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: { count?: number }) => (params?.count === undefined ? key : `${key}:${params.count}`),
  }),
}));

vi.mock("@/services/issue/issue-type-migration.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/issue/issue-type-migration.service")>();
  return {
    ...original,
    IssueTypeMigrationService: class {
      getUsage = () => Promise.resolve(preview.current);
      migrate = () => Promise.resolve(preview.current);
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
    migrateIssueType,
    getActiveProjectIssueTypes: () => [makeType("story"), makeType("bug")],
    getIssueTypeById: () => null,
  }),
}));

vi.mock("@/hooks/store/use-issue-custom-properties", () => ({
  useIssueCustomProperties: () => ({ getActiveProjectProperties: () => [], getPropertyById: () => null }),
}));

const makePreview = (
  references: Partial<TTypeMigrationPreview["references"]>,
  properties: TTypeMigrationPreview["properties"] = []
): TTypeMigrationPreview => ({
  references: { work_items: 0, deleted_work_items: 0, drafts: 0, intakes: 0, automation_actions: 0, ...references },
  properties,
});

const SIZE = {
  id: "size",
  project_id: "p1",
  name: "Size",
  property_type: "TEXT",
  is_multi: false,
  relation_type: null,
  work_items: 2,
  options: [],
};

const renderDialog = (props: { scope: TTypeMigrationScope; unlink?: boolean; replacementTypeId?: string }) =>
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <IssueTypeMigrationDialog
        isOpen
        workspaceSlug="dev"
        projectId="p1"
        fromType={makeType("story")}
        onClose={vi.fn()}
        {...props}
      />
    </SWRConfig>
  );

const confirmButton = (name: string) => screen.getByRole("button", { name });
const isDisabled = (element: HTMLElement) =>
  element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
const replacementPicker = () =>
  screen.queryByText("work_item_types.settings.item_delete_confirmation.replacement_label");

describe("IssueTypeMigrationDialog", () => {
  beforeEach(() => {
    deleteIssueType.mockReset();
    migrateIssueType.mockReset();
  });

  it("asks a plain confirmation when nothing uses the type", async () => {
    preview.current = makePreview({});
    renderDialog({ scope: { project: "p1" }, unlink: true });

    await waitFor(() => expect(isDisabled(confirmButton("delete"))).toBe(false));
    expect(screen.getByText("work_item_types.settings.item_delete_confirmation.description")).not.toBeNull();
    expect(replacementPicker()).toBeNull();

    confirmButton("delete").click();
    await waitFor(() => expect(deleteIssueType).toHaveBeenCalledWith("dev", "p1", "story"));
    expect(migrateIssueType).not.toHaveBeenCalled();
  });

  it("asks for a replacement when work items use the type", async () => {
    preview.current = makePreview({ work_items: 3, deleted_work_items: 1 });
    renderDialog({ scope: { project: "p1" }, unlink: true });

    await waitFor(() => expect(replacementPicker()).not.toBeNull());
    expect(
      screen.getByText(
        "work_item_types.settings.item_delete_confirmation.in_use:3 work_item_types.settings.item_delete_confirmation.deleted_too"
      )
    ).not.toBeNull();
    expect(isDisabled(confirmButton("delete"))).toBe(true);
  });

  it("explains why when only deleted work items use the type", async () => {
    preview.current = makePreview({ deleted_work_items: 2 });
    renderDialog({ scope: { project: "p1" }, unlink: true });

    await waitFor(() => expect(replacementPicker()).not.toBeNull());
    expect(screen.getByText("work_item_types.settings.item_delete_confirmation.only_hidden")).not.toBeNull();
    expect(screen.queryByText(/in_use/)).toBeNull();
  });

  it("asks only where the values go when the new type is already chosen", async () => {
    preview.current = makePreview({ work_items: 1 }, [SIZE]);
    renderDialog({ scope: { work_items: ["item"] }, replacementTypeId: "bug" });

    await waitFor(() => expect(screen.queryByText("Size")).not.toBeNull());
    expect(screen.getByText("work_item_types.migration.values_count:2")).not.toBeNull();
    expect(replacementPicker()).toBeNull();
    expect(isDisabled(confirmButton("work_item_types.migration.confirm"))).toBe(true);
  });
});
