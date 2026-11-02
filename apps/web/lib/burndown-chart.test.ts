// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { getBurndownChartData } from "./burndown-chart";

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
