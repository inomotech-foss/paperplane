// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import type { TProjectSidebarLink } from "@plane/types";
import { ProjectLinkStore } from "./project-link.store";

const makeLink = (id: string, project: string, sortOrder: number): TProjectSidebarLink => ({
  id,
  project,
  title: id,
  url: `/${id}`,
  sort_order: sortOrder,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

const makeStore = (links: TProjectSidebarLink[]) => {
  const store = new ProjectLinkStore();
  store.linkMap = Object.fromEntries(links.map((link) => [link.id, link]));
  return store;
};

describe("ProjectLinkStore", () => {
  it("returns a project's links in sort order", () => {
    const store = makeStore([makeLink("b", "p1", 2000), makeLink("a", "p1", 1000), makeLink("x", "p2", 500)]);

    expect(store.getLinksByProjectId("p1").map((link) => link.id)).toEqual(["a", "b"]);
  });

  it("restores the previous order when reordering fails", async () => {
    const store = makeStore([makeLink("a", "p1", 1000), makeLink("b", "p1", 2000)]);
    store.linkService.reorder = vi.fn().mockRejectedValue({ error: "nope" });

    await expect(store.reorderLinks("ws", "p1", ["b", "a"])).rejects.toEqual({ error: "nope" });

    expect(store.getLinksByProjectId("p1").map((link) => link.id)).toEqual(["a", "b"]);
  });

  it("applies the server order after reordering", async () => {
    const store = makeStore([makeLink("a", "p1", 1000), makeLink("b", "p1", 2000)]);
    store.linkService.reorder = vi.fn().mockResolvedValue([makeLink("b", "p1", 1000), makeLink("a", "p1", 2000)]);

    await store.reorderLinks("ws", "p1", ["b", "a"]);

    expect(store.getLinksByProjectId("p1").map((link) => link.id)).toEqual(["b", "a"]);
  });
});
