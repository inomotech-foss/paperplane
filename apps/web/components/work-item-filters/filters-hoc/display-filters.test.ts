// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { IIssueDisplayFilterOptions } from "@plane/types";
import { EIssueLayoutTypes } from "@plane/types";
import { getComputedDisplayFilters } from "@plane/utils";
import { hasDisplayFilterChanges } from "./display-filters";

// a view saved before the colour source existed
const oldView: IIssueDisplayFilterOptions = {
  calendar: { show_weekends: false, layout: "month" },
  layout: EIssueLayoutTypes.GANTT,
  order_by: "sort_order",
  group_by: null,
  sub_group_by: null,
  sub_issue: false,
  show_empty_groups: false,
  hierarchy: false,
  pql: "",
};

describe("getComputedDisplayFilters", () => {
  it("leaves the colour source unset when the stored filters lack it", () => {
    expect(getComputedDisplayFilters(oldView).color_by).toBeUndefined();
  });

  it("keeps a non-default colour source", () => {
    expect(getComputedDisplayFilters({ ...oldView, color_by: "key" }).color_by).toBe("key");
  });
});

describe("hasDisplayFilterChanges", () => {
  it("is clean for an old view loaded as is", () => {
    expect(hasDisplayFilterChanges(getComputedDisplayFilters(oldView), oldView)).toBe(false);
  });

  it("treats the default colour source as unset", () => {
    expect(hasDisplayFilterChanges({ ...getComputedDisplayFilters(oldView), color_by: "state" }, oldView)).toBe(false);
  });

  it("is dirty when the colour source changes", () => {
    expect(hasDisplayFilterChanges({ ...getComputedDisplayFilters(oldView), color_by: "key" }, oldView)).toBe(true);
  });
});
