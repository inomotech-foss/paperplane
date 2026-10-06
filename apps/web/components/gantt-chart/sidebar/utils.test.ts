/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it, vi } from "vitest";
import type { IGanttBlock } from "@plane/types";
import { getSiblingDrop, getSortOrderAt, handleOrderChange } from "./utils";

// a > (a1 > a1x), a2; b; c, flattened depth first as the timeline renders it
const ROWS = ["a", "a1", "a1x", "a2", "b", "c"];
const PARENTS: Record<string, string | null> = { a: null, a1: "a", a1x: "a1", a2: "a", b: null, c: null };
const SORT_ORDER: Record<string, number> = { a: 1000, a1: 5000, a1x: 100, a2: 6000, b: 2000, c: 3000 };
const getParentId = (id: string) => PARENTS[id];

const drop = (draggingBlockId: string, droppedBlockId: string, dropAtEndOfList = false) =>
  getSiblingDrop({ blockIds: ROWS, draggingBlockId, droppedBlockId, dropAtEndOfList, getParentId });

describe("getSiblingDrop", () => {
  it("places a top-level row among top-level rows only", () => {
    expect(drop("c", "a")).toEqual({ siblingIds: ["a", "b"], index: 0, sourceIndex: 2 });
    expect(drop("c", "b")).toEqual({ siblingIds: ["a", "b"], index: 1, sourceIndex: 2 });
    expect(drop("a", "c", true)).toEqual({ siblingIds: ["b", "c"], index: 2, sourceIndex: 0 });
  });

  it("moves a child to the top or bottom of its own sibling group", () => {
    // above a1: between the parent and its first child
    expect(drop("a2", "a1")).toEqual({ siblingIds: ["a1"], index: 0, sourceIndex: 1 });
    // above b: closes a's group, after a2
    expect(drop("a1", "b")).toEqual({ siblingIds: ["a2"], index: 1, sourceIndex: 0 });
  });

  it("rejects drops onto a different parent", () => {
    // between a parent and its child
    expect(drop("b", "a1")).toBeUndefined();
    expect(drop("b", "a1x")).toBeUndefined();
    // a child into the top-level group
    expect(drop("a2", "c")).toBeUndefined();
    expect(drop("a2", "c", true)).toBeUndefined();
    // a grandchild into its parent's group
    expect(drop("a1x", "a2")).toBeUndefined();
  });

  it("rejects drops that leave the row where it is", () => {
    expect(drop("b", "c")).toBeUndefined();
    expect(drop("a1", "a2")).toBeUndefined();
    expect(drop("c", "c", true)).toBeUndefined();
  });

  it("rejects drops into the dragged row's own subtree", () => {
    expect(drop("a", "a1")).toBeUndefined();
    expect(drop("a", "a2")).toBeUndefined();
  });

  it("treats every row as a sibling without hierarchy", () => {
    expect(
      getSiblingDrop({ blockIds: ["x", "y", "z"], draggingBlockId: "z", droppedBlockId: "y", dropAtEndOfList: false })
    ).toEqual({ siblingIds: ["x", "y"], index: 1, sourceIndex: 2 });
  });
});

describe("getSortOrderAt", () => {
  const getSortOrder = (id: string) => SORT_ORDER[id];

  it("goes before the first, after the last or between two siblings", () => {
    expect(getSortOrderAt(["a", "b"], 0, getSortOrder)).toBe(0);
    expect(getSortOrderAt(["a", "b"], 2, getSortOrder)).toBe(3000);
    expect(getSortOrderAt(["a", "b", "c"], 1, getSortOrder)).toBe(1500);
  });

  it("has nothing to compute without siblings", () => {
    expect(getSortOrderAt([], 0, getSortOrder)).toBeUndefined();
  });
});

describe("handleOrderChange", () => {
  const getBlockById = (id: string) => ({ id, sort_order: SORT_ORDER[id], data: { id } }) as unknown as IGanttBlock;

  it("computes the sort order from siblings in a list of mixed depths", () => {
    const update = vi.fn();
    // c between a and b: a1, a1x and a2 sit in between but belong to a
    handleOrderChange("c", "b", false, ROWS, getBlockById, update, getParentId);
    expect(update).toHaveBeenCalledWith({ id: "c" }, { sort_order: expect.objectContaining({ newSortOrder: 1500 }) });

    update.mockClear();
    // a1 to the bottom of a's group: a1x sits right above b but is a grandchild
    handleOrderChange("a1", "b", false, ROWS, getBlockById, update, getParentId);
    expect(update).toHaveBeenCalledWith({ id: "a1" }, { sort_order: expect.objectContaining({ newSortOrder: 7000 }) });

    update.mockClear();
    // a2 to the top of a's group: a sits right above a1 but is the parent
    handleOrderChange("a2", "a1", false, ROWS, getBlockById, update, getParentId);
    expect(update).toHaveBeenCalledWith({ id: "a2" }, { sort_order: expect.objectContaining({ newSortOrder: 4000 }) });
  });

  it("does not update on a rejected drop", () => {
    const update = vi.fn();
    handleOrderChange("b", "a1", false, ROWS, getBlockById, update, getParentId);
    handleOrderChange("a2", "c", true, ROWS, getBlockById, update, getParentId);
    expect(update).not.toHaveBeenCalled();
  });
});
