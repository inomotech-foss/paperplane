// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { CHART_COLOR_PALETTES } from "@plane/constants";
import { getChartPalette } from "./chart-palette";

const light = CHART_COLOR_PALETTES[0]?.light;
const dark = CHART_COLOR_PALETTES[0]?.dark;

describe("getChartPalette", () => {
  it("uses the dark palette for every dark theme", () => {
    expect(getChartPalette("dark")).toBe(dark);
    expect(getChartPalette("dark-contrast")).toBe(dark);
  });

  it("uses the light palette for light themes and no theme", () => {
    expect(getChartPalette("light")).toBe(light);
    expect(getChartPalette("light-contrast")).toBe(light);
    expect(getChartPalette(undefined)).toBe(light);
  });

  it("follows the custom theme's dark flag", () => {
    expect(getChartPalette("custom", true)).toBe(dark);
    expect(getChartPalette("custom", false)).toBe(light);
  });
});
