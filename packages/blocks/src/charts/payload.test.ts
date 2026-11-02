/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { formatChartValue } from "./payload";

describe("formatChartValue", () => {
  it("rounds fractions to two decimals", () => {
    expect(formatChartValue(6.0188679245283)).toBe(6.02);
  });

  it("keeps integers and text unchanged", () => {
    expect(formatChartValue(7)).toBe(7);
    expect(formatChartValue("a")).toBe("a");
  });

  it("drops values that are not text or numbers", () => {
    expect(formatChartValue(null)).toBeUndefined();
  });
});
