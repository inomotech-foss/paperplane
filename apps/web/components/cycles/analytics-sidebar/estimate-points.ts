// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ICycle } from "@plane/types";

/** Snapshots taken before they stored points fall back to the live cycle values. */
export function getCycleEstimatePoints(cycle: ICycle, fromSnapshot: boolean): { completed: number; total: number } {
  const snapshot = cycle.progress_snapshot;
  const source = fromSnapshot && snapshot?.total_estimate_points !== undefined ? snapshot : cycle;
  return { completed: source.completed_estimate_points ?? 0, total: source.total_estimate_points ?? 0 };
}
