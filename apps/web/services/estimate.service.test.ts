// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { EEstimateSystem } from "@plane/types";
import { estimateCreateBody, toEstimateSystem } from "./estimate.service";

describe("toEstimateSystem", () => {
  it("keeps every stored type, time included", () => {
    expect(toEstimateSystem("points")).toBe(EEstimateSystem.POINTS);
    expect(toEstimateSystem("categories")).toBe(EEstimateSystem.CATEGORIES);
    expect(toEstimateSystem("time")).toBe(EEstimateSystem.TIME);
  });
});

describe("estimateCreateBody", () => {
  it("sends the type and drops the point ids", () => {
    expect(
      estimateCreateBody({
        estimate: { name: "Points", type: "points", last_used: true },
        estimate_points: [{ id: "x", key: 1, value: "1" }],
      })
    ).toEqual({
      estimate: { name: "Points", type: "points", last_used: true },
      estimate_points: [{ key: 1, value: "1" }],
    });
  });

  it("sends a time estimate as time", () => {
    expect(estimateCreateBody({ estimate: { type: "time" }, estimate_points: [] }).estimate).toEqual({ type: "time" });
  });

  it("leaves out an unknown type and an absent estimate", () => {
    expect(estimateCreateBody({ estimate: { type: "hours" }, estimate_points: [] }).estimate).toEqual({});
    expect(estimateCreateBody({ estimate_points: [] }).estimate).toEqual({});
  });
});
