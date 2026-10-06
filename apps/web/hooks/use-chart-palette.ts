// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useTheme } from "next-themes";
import { useUserProfile } from "@/hooks/store/user";
import { getChartPalette } from "@/lib/chart-palette";

/** The default chart palette for the current theme. */
export const useChartPalette = (): string[] => {
  const { resolvedTheme } = useTheme();
  const { data: userProfile } = useUserProfile();
  return getChartPalette(resolvedTheme, !!userProfile?.theme?.darkPalette);
};
