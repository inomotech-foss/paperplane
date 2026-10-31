// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { parseStoredModuleDisplayFilters, parseStoredModuleFilters } from "./module-filter-storage";

describe("parseStoredModuleDisplayFilters", () => {
  it("keeps the known values of each project", () => {
    const stored = { p1: { layout: "gantt", order_by: "-name", favorites: true, extra: 1 }, p2: { layout: "grid" } };
    expect(parseStoredModuleDisplayFilters(stored)).toEqual({
      p1: { layout: "gantt", order_by: "-name", favorites: true },
      p2: {},
    });
  });

  it("returns nothing for data that is not an object", () => {
    expect(parseStoredModuleDisplayFilters(["x"])).toEqual({});
    expect(parseStoredModuleDisplayFilters(null)).toEqual({});
  });
});

describe("parseStoredModuleFilters", () => {
  it("keeps string lists and nulls per list", () => {
    const stored = { p1: { default: { lead: ["u1"], status: null, members: [1] }, archived: "x" } };
    expect(parseStoredModuleFilters(stored)).toEqual({ p1: { default: { lead: ["u1"], status: null }, archived: {} } });
  });
});
