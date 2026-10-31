// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { EEstimateSystem } from "@plane/types";
import { estimateCreateBody, toEstimateSystem, toEstimateType } from "./estimate.service";

describe("estimate type mapping", () => {
  it("maps the stored systems both ways", () => {
    expect(toEstimateType(EEstimateSystem.POINTS)).toBe("points");
    expect(toEstimateType(EEstimateSystem.CATEGORIES)).toBe("categories");
    expect(toEstimateSystem("points")).toBe(EEstimateSystem.POINTS);
    expect(toEstimateSystem("categories")).toBe(EEstimateSystem.CATEGORIES);
  });

  it("has no API type for time estimates", () => {
    expect(toEstimateType(EEstimateSystem.TIME)).toBeUndefined();
  });
});

describe("estimateCreateBody", () => {
  it("sends a stored type and drops the point ids", () => {
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

  it("leaves out a type the API does not store and an absent estimate", () => {
    expect(estimateCreateBody({ estimate: { type: "time" }, estimate_points: [] })).toEqual({
      estimate: {},
      estimate_points: [],
    });
    expect(estimateCreateBody({ estimate_points: [] }).estimate).toEqual({});
  });
});
