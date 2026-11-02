// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ICycle } from "@plane/types";

type TCycleCounts = Pick<ICycle, "total_issues" | "cancelled_issues" | "completed_issues">;

/** Cancelled work items are left out of both sides, so the counts match the state group breakdown. */
export const getCycleCompletion = (cycle: TCycleCounts | null) => {
  const total = (cycle?.total_issues ?? 0) - (cycle?.cancelled_issues ?? 0);
  const completed = cycle?.completed_issues ?? 0;
  return { completed, total, percentage: total > 0 ? (completed / total) * 100 : 0 };
};
