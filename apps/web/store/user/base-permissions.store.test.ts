// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { IWorkspaceMemberMe } from "@plane/types";
import { DEFAULT_WORKSPACE_VIEW_PROPS, EUserWorkspaceRoles } from "@plane/types";
import { store as rootStore } from "@/lib/store-context";
import { WorkspaceService } from "@/services/workspace.service";
import { BaseUserPermissionStore } from "./base-permissions.store";

const member = (changes: Partial<IWorkspaceMemberMe> = {}): IWorkspaceMemberMe => ({
  company_role: null,
  created_at: "2026-01-01T00:00:00Z",
  created_by: null,
  default_props: DEFAULT_WORKSPACE_VIEW_PROPS,
  id: "m1",
  member: "u1",
  role: EUserWorkspaceRoles.MEMBER,
  updated_at: "2026-01-01T00:00:00Z",
  updated_by: null,
  view_props: DEFAULT_WORKSPACE_VIEW_PROPS,
  workspace: "w1",
  pql_dialect: null,
  ...changes,
});

const makeStore = () => {
  const store = new BaseUserPermissionStore(rootStore);
  store.workspaceUserInfo = { ws: member() };
  return store;
};

describe("BaseUserPermissionStore.updateWorkspaceMemberDialect", () => {
  afterEach(() => vi.restoreAllMocks());

  it("stores the new dialect", async () => {
    const update = vi
      .spyOn(WorkspaceService.prototype, "updateWorkspaceMemberMe")
      .mockResolvedValue(member({ pql_dialect: "plane" }));
    const store = makeStore();

    await store.updateWorkspaceMemberDialect("ws", "plane");

    expect(update).toHaveBeenCalledWith("ws", { pql_dialect: "plane" });
    expect(store.workspaceInfoBySlug("ws")?.pql_dialect).toBe("plane");
  });

  it("keeps the old dialect when the update fails", async () => {
    vi.spyOn(WorkspaceService.prototype, "updateWorkspaceMemberMe").mockRejectedValue(new Error("nope"));
    const store = makeStore();

    await expect(store.updateWorkspaceMemberDialect("ws", "plane")).rejects.toThrow("nope");
    expect(store.workspaceInfoBySlug("ws")?.pql_dialect).toBeNull();
  });
});
