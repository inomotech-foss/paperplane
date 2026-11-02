// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { render, screen } from "@testing-library/react";
import { observer } from "mobx-react";
import type { IIssueLabel, IIssueLabelTree } from "@plane/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LabelStore } from "@/store/label.store";
import { ProjectSettingsLabelList } from "./project-setting-label-list";

const labels = vi.hoisted(() => {
  const holder: { store: unknown } = { store: undefined };
  return holder;
});

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "ws", projectId: "p1" }) }));
vi.mock("@/hooks/store/use-label", () => ({ useLabel: () => labels.store }));
vi.mock("@/hooks/queries/use-label-queries", () => ({
  useProjectLabels: () => ({ isLoading: false, error: undefined, retry: vi.fn(), ensureLoaded: vi.fn() }),
}));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => true }) }));
vi.mock("../settings/heading", () => ({ SettingsHeading: () => null }));
vi.mock("@/components/labels", () => {
  const LabelRow = observer(function LabelRow({ label }: { label: IIssueLabelTree }) {
    return (
      <li>
        {label.name}
        <ul>
          {(label.children ?? []).map((child) => (
            <li key={child.id}>{child.name}</li>
          ))}
        </ul>
      </li>
    );
  });
  return {
    CreateUpdateLabelInline: () => null,
    DeleteLabelModal: () => null,
    ProjectSettingLabelGroup: LabelRow,
    ProjectSettingLabelItem: LabelRow,
  };
});

const label = (id: string, parent: string | null, sort_order: number): IIssueLabel => ({
  id,
  name: id,
  color: "#000",
  project_id: "p1",
  workspace_id: "w1",
  parent,
  sort_order,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProjectSettingsLabelList", () => {
  it("renders nested labels without changing the store while rendering", () => {
    const error = vi.spyOn(console, "error");
    const warn = vi.spyOn(console, "warn");
    const store = new LabelStore({
      router: { projectId: "p1" },
      workspaceRoot: { currentWorkspace: null, getWorkspaceBySlug: () => null },
    });
    store.labelMap = { bug: label("bug", null, 1), ui: label("ui", "bug", 2), api: label("api", "bug", 3) };
    labels.store = store;

    render(<ProjectSettingsLabelList />);

    expect(screen.getByText("ui")).toBeTruthy();
    expect(screen.getByText("api")).toBeTruthy();
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect("children" in store.labelMap.bug).toBe(false);
  });
});
