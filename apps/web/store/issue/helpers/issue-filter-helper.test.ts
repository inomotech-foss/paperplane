// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { EServerGroupByToFilterOptions } from "@plane/constants";
import { EIssueLayoutTypes } from "@plane/types";
import {
  toDisplayFilterChanges,
  toDisplayPropertyChanges,
  toGroupFilterOption,
  toKanbanFilterChanges,
} from "./issue-filter-helper.store";

describe("filter update narrowing", () => {
  it("keeps only the keys of each filter kind", () => {
    expect(toDisplayFilterChanges({ layout: EIssueLayoutTypes.KANBAN })).toEqual({ layout: "kanban" });
    expect(toDisplayPropertyChanges({ key: true, custom_property_x: false })).toEqual({
      key: true,
      custom_property_x: false,
    });
    expect(toKanbanFilterChanges({ group_by: ["a"], sub_group_by: [] })).toEqual({ group_by: ["a"], sub_group_by: [] });
    expect(toKanbanFilterChanges({ group_by: "state" })).toEqual({});
  });

  it("maps a server group to its filter param", () => {
    expect(toGroupFilterOption("labels__id")).toBe(EServerGroupByToFilterOptions.labels__id);
    expect(toGroupFilterOption("bogus")).toBeUndefined();
  });
});
