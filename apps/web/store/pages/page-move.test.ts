/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it, vi } from "vitest";
import type { TPage } from "@plane/types";
import { BasePage } from "./base-page";
import type { TProjectPage } from "./project-page";
import { ProjectPageStore } from "./project-page.store";

const createPage = (update: ReturnType<typeof vi.fn>, data: Partial<TPage> = {}) =>
  new BasePage(
    {} as never,
    { id: "p1", name: "Page", parent: "a", sort_order: 65535, ...data } as TPage,
    {
      update,
    } as never
  );

describe("BasePage.move", () => {
  it("updates both fields with a single PATCH", async () => {
    const update = vi.fn().mockResolvedValue({});
    const page = createPage(update);
    await page.move({ parentId: "b", sortOrder: 5 });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ parent: "b", sort_order: 5 });
    expect(page.parent).toBe("b");
    expect(page.sort_order).toBe(5);
  });

  it("rolls back both fields when the update fails", async () => {
    const update = vi.fn().mockRejectedValue(new Error("fail"));
    const page = createPage(update);
    await expect(page.move({ parentId: "b", sortOrder: 5 })).rejects.toThrow("fail");
    expect(page.parent).toBe("a");
    expect(page.sort_order).toBe(65535);
  });
});

describe("ProjectPageStore.renumberSiblings", () => {
  const createStore = (pages: Record<string, Partial<TProjectPage>>) => {
    const store = new ProjectPageStore({} as never);
    const data: Record<string, unknown> = {};
    for (const [id, page] of Object.entries(pages)) {
      data[id] = { is_locked: false, canCurrentUserMovePage: true, parent: null, move: vi.fn(), ...page };
    }
    store.data = data as never;
    return { store, data: data as Record<string, { move: ReturnType<typeof vi.fn> }> };
  };

  it("assigns 10000, 20000, ... in the given order", async () => {
    const { store, data } = createStore({
      a: { sort_order: 65535 },
      b: { sort_order: 65535 },
      c: { sort_order: 65535 },
    });
    await store.renumberSiblings(null, ["c", "b", "a"]);
    expect(data.c.move).toHaveBeenCalledWith({ parentId: null, sortOrder: 10000 });
    expect(data.b.move).toHaveBeenCalledWith({ parentId: null, sortOrder: 20000 });
    expect(data.a.move).toHaveBeenCalledWith({ parentId: null, sortOrder: 30000 });
  });

  it("skips pages whose value and parent are unchanged", async () => {
    const { store, data } = createStore({ a: { sort_order: 10000 }, b: { sort_order: 65535 } });
    await store.renumberSiblings(null, ["a", "b"]);
    expect(data.a.move).not.toHaveBeenCalled();
    expect(data.b.move).toHaveBeenCalledTimes(1);
  });

  it("refuses when a sibling is locked", async () => {
    const { store, data } = createStore({ a: { sort_order: 1 }, b: { sort_order: 2, is_locked: true } });
    await expect(store.renumberSiblings(null, ["a", "b"])).rejects.toThrow();
    expect(data.a.move).not.toHaveBeenCalled();
  });

  it("rethrows a failure after all updates settle", async () => {
    const { store, data } = createStore({ a: { sort_order: 1 }, b: { sort_order: 2 } });
    data.a.move.mockRejectedValue(new Error("fail"));
    await expect(store.renumberSiblings(null, ["a", "b"])).rejects.toThrow("fail");
    expect(data.b.move).toHaveBeenCalledTimes(1);
  });
});
