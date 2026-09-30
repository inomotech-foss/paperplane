import { describe, expect, it } from "vitest";
import { buildIssueHierarchy } from "./hierarchy";

const parents = (map: Record<string, string | null>) => (id: string) => map[id];

describe("buildIssueHierarchy", () => {
  it("keeps a flat list flat when no parents are loaded", () => {
    const tree = buildIssueHierarchy(["inv1", "inv2"], parents({ inv1: "quote", inv2: "quote" }));
    expect(tree.rootIds).toEqual(["inv1", "inv2"]);
    expect(tree.childIdsByParentId.size).toBe(0);
  });

  it("nests a customer, its story, quote and invoices in order", () => {
    const ids = ["customer", "story", "quote", "inv1", "inv2", "other"];
    const tree = buildIssueHierarchy(
      ids,
      parents({ customer: null, story: "customer", quote: "story", inv1: "quote", inv2: "quote", other: null })
    );
    expect(tree.rootIds).toEqual(["customer", "other"]);
    expect(tree.childIdsByParentId.get("customer")).toEqual(["story"]);
    expect(tree.childIdsByParentId.get("story")).toEqual(["quote"]);
    expect(tree.childIdsByParentId.get("quote")).toEqual(["inv1", "inv2"]);
  });

  it("makes a child whose parent is not loaded a root", () => {
    const tree = buildIssueHierarchy(["story", "quote"], parents({ story: "customer", quote: "story" }));
    expect(tree.rootIds).toEqual(["story"]);
    expect(tree.childIdsByParentId.get("story")).toEqual(["quote"]);
  });

  it("preserves the list order among roots regardless of where children sit", () => {
    const tree = buildIssueHierarchy(["b", "a1", "a", "c"], parents({ b: null, a1: "a", a: null, c: null }));
    expect(tree.rootIds).toEqual(["b", "a", "c"]);
    expect(tree.childIdsByParentId.get("a")).toEqual(["a1"]);
  });

  it("never hides the members of a parent cycle", () => {
    const tree = buildIssueHierarchy(["x", "y", "z"], parents({ x: "y", y: "x", z: "y" }));
    expect(new Set(tree.rootIds)).toEqual(new Set(["x"]));
    // y still hangs under x, z under y: every item is reachable exactly once
    const seen: string[] = [];
    const walk = (id: string) => {
      seen.push(id);
      (tree.childIdsByParentId.get(id) ?? []).forEach(walk);
    };
    tree.rootIds.forEach(walk);
    expect(seen).toHaveLength(3);
    expect(new Set(seen)).toEqual(new Set(["x", "y", "z"]));
  });

  it("ignores an item that names itself as parent", () => {
    const tree = buildIssueHierarchy(["a"], parents({ a: "a" }));
    expect(tree.rootIds).toEqual(["a"]);
  });
});
