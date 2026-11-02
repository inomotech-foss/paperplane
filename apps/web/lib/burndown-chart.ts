// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ICycle, TChartData, TCycleEstimateType, TModuleCompletionChartDistribution } from "@plane/types";
import { renderFormattedDateWithoutYear } from "@plane/utils";

export type TBurndownChartDatum = TChartData<"name", "current" | "ideal">;

export type TBurndownScope = { total: number; cancelled: number };

/**
 * The scope of a cycle's burndown chart. Snapshots written before cancelled work left the scope
 * keep cancelled work in their stored chart, so their ideal line keeps it too.
 */
export const getCycleBurndownScope = (cycle: ICycle | null, estimateType: TCycleEstimateType): TBurndownScope => {
  const snapshot = cycle?.progress_snapshot ?? {};
  const isOldSnapshot = Object.keys(snapshot).length > 0 && snapshot.burndown_scope !== "excludes_cancelled";
  const scope =
    estimateType === "points"
      ? { total: cycle?.total_estimate_points || 0, cancelled: cycle?.cancelled_estimate_points || 0 }
      : { total: cycle?.total_issues || 0, cancelled: cycle?.cancelled_issues || 0 };
  return isOldSnapshot ? { ...scope, cancelled: 0 } : scope;
};

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
