/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { EIssueLayoutTypes } from "@plane/types";
import { getModuleOrderBy, getWorkItemOrderBy } from "./timeline-order";

describe("getWorkItemOrderBy", () => {
  it("forces manual order on the timeline", () => {
    expect(getWorkItemOrderBy({ layout: EIssueLayoutTypes.GANTT, order_by: "-priority" })).toBe("sort_order");
    expect(getWorkItemOrderBy({ layout: EIssueLayoutTypes.GANTT })).toBe("sort_order");
  });

  it("keeps the stored order on other layouts", () => {
    expect(getWorkItemOrderBy({ layout: EIssueLayoutTypes.LIST, order_by: "-priority" })).toBe("-priority");
    expect(getWorkItemOrderBy({ layout: EIssueLayoutTypes.KANBAN, order_by: "start_date" })).toBe("start_date");
    expect(getWorkItemOrderBy({ layout: EIssueLayoutTypes.SPREADSHEET })).toBeUndefined();
    expect(getWorkItemOrderBy(undefined)).toBeUndefined();
  });
});

describe("getModuleOrderBy", () => {
  it("forces manual order on the module timeline only", () => {
    expect(getModuleOrderBy({ layout: "gantt", order_by: "name" })).toBe("sort_order");
    expect(getModuleOrderBy({ layout: "list", order_by: "name" })).toBe("name");
    expect(getModuleOrderBy({ layout: "board", order_by: "-progress" })).toBe("-progress");
  });
});
