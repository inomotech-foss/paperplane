/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { getReorderPlacement } from "./page-order";

const parents: Record<string, string | null> = {
  a: null,
  b: null,
  c: null,
  orphan: "hidden",
  child: "a",
};
const getParentId = (id: string) => parents[id] ?? null;

describe("getReorderPlacement", () => {
  it("anchors after the row above the drop", () => {
    expect(
      getReorderPlacement({
        sourceId: "c",
        targetId: "b",
        position: "above",
        parentId: null,
        visibleSiblingIds: ["a", "b", "c"],
        getParentId,
      })
    ).toEqual({ parentId: null, after: "a" });
  });

  it("anchors before the first row when dropping at the top", () => {
    expect(
      getReorderPlacement({
        sourceId: "c",
        targetId: "a",
        position: "above",
        parentId: null,
        visibleSiblingIds: ["a", "b", "c"],
        getParentId,
      })
    ).toEqual({ parentId: null, before: "a" });
  });

  it("anchors after the target when dropping below it", () => {
    expect(
      getReorderPlacement({
        sourceId: "a",
        targetId: "c",
        position: "below",
        parentId: null,
        visibleSiblingIds: ["a", "b", "c"],
        getParentId,
      })
    ).toEqual({ parentId: null, after: "c" });
  });

  it("skips top-level rows whose parent is in another tab", () => {
    expect(
      getReorderPlacement({
        sourceId: "c",
        targetId: "orphan",
        position: "below",
        parentId: null,
        visibleSiblingIds: ["orphan", "a", "c"],
        getParentId,
      })
    ).toEqual({ parentId: null, before: "a" });
    expect(
      getReorderPlacement({
        sourceId: "c",
        targetId: "orphan",
        position: "above",
        parentId: null,
        visibleSiblingIds: ["a", "orphan", "c"],
        getParentId,
      })
    ).toEqual({ parentId: null, after: "a" });
  });

  it("moves a child to the top level next to a root row", () => {
    expect(
      getReorderPlacement({
        sourceId: "child",
        targetId: "b",
        position: "below",
        parentId: null,
        visibleSiblingIds: ["a", "b"],
        getParentId,
      })
    ).toEqual({ parentId: null, after: "b" });
  });

  it("falls back to the end when no real sibling is visible", () => {
    expect(
      getReorderPlacement({
        sourceId: "c",
        targetId: "orphan",
        position: "above",
        parentId: null,
        visibleSiblingIds: ["orphan", "c"],
        getParentId,
      })
    ).toEqual({ parentId: null });
  });
});
