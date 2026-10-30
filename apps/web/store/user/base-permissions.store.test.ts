// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { IWorkspaceMemberMe } from "@plane/types";
import { WorkspaceService } from "@/services/workspace.service";
import type { RootStore } from "@/store/root.store";
import { BaseUserPermissionStore } from "./base-permissions.store";

const makeStore = () => {
  const store = new BaseUserPermissionStore({} as RootStore);
  store.workspaceUserInfo = { ws: { id: "m1", role: 15, pql_dialect: null } as IWorkspaceMemberMe };
  return store;
};

describe("BaseUserPermissionStore.updateWorkspaceMemberDialect", () => {
  afterEach(() => vi.restoreAllMocks());

  it("stores the new dialect", async () => {
    const update = vi
      .spyOn(WorkspaceService.prototype, "updateWorkspaceMemberMe")
      .mockResolvedValue({ id: "m1", pql_dialect: "plane" } as IWorkspaceMemberMe);
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
