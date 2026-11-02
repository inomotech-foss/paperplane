// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { ICycle } from "@plane/types";
import { getBurndownChartData, getCycleBurndownScope } from "./burndown-chart";

describe("getBurndownChartData", () => {
  const distribution = { "2026-11-01": 10, "2026-11-02": 8, "2026-11-03": null };

  it("leaves future dates empty instead of plotting 0", () => {
    expect(getBurndownChartData(distribution, 10, 0).map((d) => d.current)).toEqual([10, 8, null]);
  });

  it("draws the ideal line over the whole range", () => {
    expect(getBurndownChartData(distribution, 10, 0).map((d) => d.ideal)).toEqual([10, 5, 0]);
  });

  it("starts the ideal line without cancelled work", () => {
    expect(getBurndownChartData({ "2026-11-01": 8, "2026-11-02": 8 }, 10, 2).map((d) => d.ideal)).toEqual([8, 0]);
  });

  it("handles a single day", () => {
    expect(getBurndownChartData({ "2026-11-01": 4 }, 4, 0)[0]?.ideal).toBe(4);
  });
});

describe("getCycleBurndownScope", () => {
  const counts = { total_issues: 10, cancelled_issues: 2, total_estimate_points: 20, cancelled_estimate_points: 5 };
  const cycle: ICycle = {
    id: "c1",
    workspace_id: "w1",
    project_id: "p1",
    name: "Cycle",
    description: "",
    start_date: null,
    end_date: null,
    owned_by_id: "u1",
    sort_order: 1,
    ...counts,
  };

  it("leaves cancelled work out of live data", () => {
    expect(getCycleBurndownScope(cycle, "issues")).toEqual({ total: 10, cancelled: 2 });
    expect(getCycleBurndownScope(cycle, "points")).toEqual({ total: 20, cancelled: 5 });
  });

  it("leaves cancelled work out of marked snapshots", () => {
    const snapshot = { ...counts, burndown_scope: "excludes_cancelled" as const };
    expect(getCycleBurndownScope({ ...cycle, progress_snapshot: snapshot }, "issues")).toEqual({
      total: 10,
      cancelled: 2,
    });
  });

  it("keeps cancelled work in snapshots stored before the marker", () => {
    expect(getCycleBurndownScope({ ...cycle, progress_snapshot: counts }, "issues")).toEqual({
      total: 10,
      cancelled: 0,
    });
    expect(getCycleBurndownScope({ ...cycle, progress_snapshot: counts }, "points")).toEqual({
      total: 20,
      cancelled: 0,
    });
  });
});
