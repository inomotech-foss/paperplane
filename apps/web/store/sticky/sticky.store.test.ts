/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TSticky } from "@plane/types";
import { StickyStore } from "./sticky.store";

const service = vi.hoisted(() => ({ createSticky: vi.fn(), updateSticky: vi.fn(), deleteSticky: vi.fn() }));

vi.mock("@/services/sticky.service", () => ({
  StickyService: class {
    createSticky = service.createSticky;
    updateSticky = service.updateSticky;
    deleteSticky = service.deleteSticky;
  },
}));

const sticky = (id: string, sort_order: number): TSticky => ({
  id,
  workspace: "w1",
  logo_props: undefined,
  sort_order,
  description_html: "<p>a</p>",
});

describe("StickyStore", () => {
  let store: StickyStore;

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    store = new StickyStore();
    store.stickies = { s1: sticky("s1", 2), s2: sticky("s2", 1) };
    store.workspaceStickies = { ws: ["s1", "s2"] };
    store.recentStickyId = "s1";
  });

  it("restores the changed fields when an update fails", async () => {
    service.updateSticky.mockRejectedValueOnce(new Error("failed"));
    await expect(store.updateSticky("ws", "s1", { description_html: "<p>b</p>" })).rejects.toThrow();
    expect(store.stickies.s1.description_html).toBe("<p>a</p>");
  });

  it("restores the sticky list when a delete fails", async () => {
    service.deleteSticky.mockRejectedValueOnce(new Error("failed"));
    await store.deleteSticky("ws", "s1");
    expect(store.stickies.s1).toBeDefined();
    expect(store.workspaceStickies.ws).toEqual(["s1", "s2"]);
    expect(store.recentStickyId).toBe("s1");
  });

  it("marks a new sticky for focus until its editor takes focus", async () => {
    service.createSticky.mockResolvedValueOnce(sticky("s3", 3));
    store.toggleShowNewSticky(true);
    await store.createSticky("ws", {});
    expect(store.focusStickyId).toBe("s3");
    store.clearStickyFocus("s1");
    expect(store.focusStickyId).toBe("s3");
    store.clearStickyFocus("s3");
    expect(store.focusStickyId).toBeUndefined();
  });
});
