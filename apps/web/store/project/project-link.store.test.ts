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
  store.linkMap = { ws: Object.fromEntries(links.map((link) => [link.id, link])) };
  return store;
};

const ids = (links: TProjectSidebarLink[]) => links.map((link) => link.id);

describe("ProjectLinkStore", () => {
  it("returns a project's links in sort order", () => {
    const store = makeStore([makeLink("b", "p1", 2000), makeLink("a", "p1", 1000), makeLink("x", "p2", 500)]);

    expect(ids(store.getLinksByProjectId("ws", "p1"))).toEqual(["a", "b"]);
  });

  it("keeps each workspace's links when switching workspaces", async () => {
    const store = new ProjectLinkStore();
    const listWorkspaceLinks = vi.fn((slug: string) =>
      Promise.resolve(slug === "a" ? [makeLink("a1", "pa", 1000)] : [makeLink("b1", "pb", 1000)])
    );
    store.linkService.listWorkspaceLinks = listWorkspaceLinks;

    await store.fetchWorkspaceLinks("a");
    await store.fetchWorkspaceLinks("b");

    expect(ids(store.getLinksByProjectId("a", "pa"))).toEqual(["a1"]);
    expect(ids(store.getLinksByProjectId("b", "pb"))).toEqual(["b1"]);
    expect(store.getLinksByProjectId("a", "pb")).toEqual([]);
  });

  it("refetches a single project without touching the others", async () => {
    const store = makeStore([makeLink("old", "p1", 1000), makeLink("x", "p2", 500)]);
    store.linkService.list = vi.fn().mockResolvedValue([makeLink("new", "p1", 1000)]);

    await store.fetchProjectLinks("ws", "p1");

    expect(ids(store.getLinksByProjectId("ws", "p1"))).toEqual(["new"]);
    expect(ids(store.getLinksByProjectId("ws", "p2"))).toEqual(["x"]);
  });

  it("restores the previous order when reordering fails", async () => {
    const store = makeStore([makeLink("a", "p1", 1000), makeLink("b", "p1", 2000)]);
    store.linkService.reorder = vi.fn().mockRejectedValue({ error: "nope" });

    await expect(store.reorderLinks("ws", "p1", ["b", "a"])).rejects.toEqual({ error: "nope" });

    expect(ids(store.getLinksByProjectId("ws", "p1"))).toEqual(["a", "b"]);
  });

  it("applies the server order after reordering", async () => {
    const store = makeStore([makeLink("a", "p1", 1000), makeLink("b", "p1", 2000)]);
    store.linkService.reorder = vi.fn().mockResolvedValue([makeLink("b", "p1", 1000), makeLink("a", "p1", 2000)]);

    await store.reorderLinks("ws", "p1", ["b", "a"]);

    expect(ids(store.getLinksByProjectId("ws", "p1"))).toEqual(["b", "a"]);
  });
});
