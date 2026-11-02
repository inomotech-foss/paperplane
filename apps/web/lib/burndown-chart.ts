// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { TChartData, TModuleCompletionChartDistribution } from "@plane/types";
import { renderFormattedDateWithoutYear } from "@plane/utils";

export type TBurndownChartDatum = TChartData<"name", "current" | "ideal">;

/** Future dates come back as null and stay null, so the current line stops at today. */
export const getBurndownChartData = (
  distribution: TModuleCompletionChartDistribution | undefined,
  total: number
): TBurndownChartDatum[] => {
  const dates = Object.keys(distribution ?? {});
  const lastIndex = dates.length - 1;
  return dates.map((date, index) => ({
    name: renderFormattedDateWithoutYear(date),
    current: distribution?.[date] ?? null,
    ideal: lastIndex > 0 ? total * (1 - index / lastIndex) : total,
  }));
};
