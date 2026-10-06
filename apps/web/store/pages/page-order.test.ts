/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { getInsertSortOrder, RENUMBER_SIBLINGS, renumberedSortOrder } from "./page-order";

describe("getInsertSortOrder", () => {
  it("returns the default for an empty list", () => {
    expect(getInsertSortOrder([], 0)).toBe(65535);
  });

  it("uses the midpoint between neighbours", () => {
    expect(getInsertSortOrder([10000, 20000, 40000], 2)).toBe(30000);
  });

  it("goes before the first", () => {
    expect(getInsertSortOrder([20000, 30000], 0)).toBe(10000);
  });

  it("goes after the last", () => {
    expect(getInsertSortOrder([20000, 30000], 2)).toBe(40000);
  });

  it("signals renumbering for equal neighbours", () => {
    expect(getInsertSortOrder([65535, 65535, 65535], 1)).toBe(RENUMBER_SIBLINGS);
  });

  it("signals renumbering when no float fits between neighbours", () => {
    expect(getInsertSortOrder([1, 1 + Number.EPSILON], 1)).toBe(RENUMBER_SIBLINGS);
  });

  it("handles negative values", () => {
    expect(getInsertSortOrder([-30000, -10000], 0)).toBe(-40000);
    expect(getInsertSortOrder([-30000, -10000], 1)).toBe(-20000);
  });

  it("signals renumbering after repeated halving runs out of room", () => {
    let after = 20000;
    let result = getInsertSortOrder([10000, after], 1);
    for (let i = 0; i < 100 && result !== RENUMBER_SIBLINGS; i++) {
      after = result as number;
      result = getInsertSortOrder([10000, after], 1);
    }
    expect(result).toBe(RENUMBER_SIBLINGS);
  });

  it("handles float neighbours", () => {
    expect(getInsertSortOrder([1.5, 2.5], 1)).toBe(2);
  });

  it("does not need renumbering at the ends of tied siblings", () => {
    expect(getInsertSortOrder([65535, 65535], 0)).toBe(55535);
    expect(getInsertSortOrder([65535, 65535], 2)).toBe(75535);
  });
});

describe("renumberedSortOrder", () => {
  it("assigns 10000, 20000, ...", () => {
    expect([0, 1, 2].map(renumberedSortOrder)).toEqual([10000, 20000, 30000]);
  });
});
