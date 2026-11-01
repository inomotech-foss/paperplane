// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { ICycle } from "@plane/types";
import { getCycleEstimatePoints } from "./estimate-points";

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
  completed_estimate_points: 2,
  total_estimate_points: 4,
};

describe("getCycleEstimatePoints", () => {
  it("reads the snapshot points", () => {
    const snapshot = { total_issues: 3, completed_estimate_points: 5, total_estimate_points: 8 };
    expect(getCycleEstimatePoints({ ...cycle, progress_snapshot: snapshot }, true)).toEqual({ completed: 5, total: 8 });
  });

  it("falls back to the cycle for snapshots without points", () => {
    expect(getCycleEstimatePoints({ ...cycle, progress_snapshot: { total_issues: 3 } }, true)).toEqual({
      completed: 2,
      total: 4,
    });
  });

  it("never returns undefined", () => {
    const { completed_estimate_points: _c, total_estimate_points: _t, ...bare } = cycle;
    expect(getCycleEstimatePoints(bare, false)).toEqual({ completed: 0, total: 0 });
  });
});
