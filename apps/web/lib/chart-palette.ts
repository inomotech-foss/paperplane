// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { CHART_COLOR_PALETTES, THEME_OPTIONS } from "@plane/constants";

const DARK_THEMES = new Set(THEME_OPTIONS.filter((option) => option.type === "dark").map((option) => option.value));

/** The default chart palette for a resolved theme; a custom theme is dark when its profile says so. */
export const getChartPalette = (resolvedTheme: string | undefined, isCustomThemeDark = false): string[] => {
  const isDark = resolvedTheme === "custom" ? isCustomThemeDark : DARK_THEMES.has(resolvedTheme ?? "");
  return CHART_COLOR_PALETTES[0]?.[isDark ? "dark" : "light"] ?? [];
};
