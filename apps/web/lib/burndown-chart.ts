// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { TChartData, TModuleCompletionChartDistribution } from "@plane/types";
import { renderFormattedDateWithoutYear } from "@plane/utils";

export type TBurndownChartDatum = TChartData<"name", "current" | "ideal">;

/**
 * Future dates come back as null and stay null, so the current line stops at today.
 * Cancelled work is not remaining scope, so the ideal line starts at total minus cancelled.
 */
export const getBurndownChartData = (
  distribution: TModuleCompletionChartDistribution | undefined,
  total: number,
  cancelled: number
): TBurndownChartDatum[] => {
  const scope = Math.max(total - cancelled, 0);
  const dates = Object.keys(distribution ?? {});
  const lastIndex = dates.length - 1;
  return dates.map((date, index) => ({
    name: renderFormattedDateWithoutYear(date),
    current: distribution?.[date] ?? null,
    ideal: lastIndex > 0 ? scope * (1 - index / lastIndex) : scope,
  }));
};
