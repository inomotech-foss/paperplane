/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type {
  TPageBaselineCandidate,
  TPageBaselinePreview,
  TPageBaselineRequest,
  TPageBaselineSkipReason,
} from "@/services/page";

export const BASELINE_SKIP_REASON_KEYS: Record<TPageBaselineSkipReason, string> = {
  archived: "page_approval_baseline.skip_reason.archived",
  already_baselined: "page_approval_baseline.skip_reason.already_baselined",
  already_approved: "page_approval_baseline.skip_reason.already_approved",
  in_review: "page_approval_baseline.skip_reason.in_review",
  rejected: "page_approval_baseline.skip_reason.rejected",
  has_approval_history: "page_approval_baseline.skip_reason.has_approval_history",
  locked: "page_approval_baseline.skip_reason.locked",
};

/** Locked pages can be baselined only when the admin includes them. */
export const canBaseline = (row: Pick<TPageBaselineCandidate, "skip_reason">, includeLocked: boolean): boolean =>
  row.skip_reason === null || (includeLocked && row.skip_reason === "locked");

export const eligibleCount = (totals: TPageBaselinePreview["totals"], includeLocked: boolean): number =>
  totals.eligible + (includeLocked ? totals.locked : 0);

/** The pages to baseline: every page that can be, less the ones the admin left out. */
export const selectedPageIds = (
  pages: TPageBaselineCandidate[],
  includeLocked: boolean,
  excluded: ReadonlySet<string>
): string[] => pages.filter((row) => canBaseline(row, includeLocked) && !excluded.has(row.page)).map((row) => row.page);

export const baselineRequest = (form: {
  pageIds: string[];
  includeLocked: boolean;
  nextReviewDate: string | null;
  comment: string;
}): TPageBaselineRequest => ({
  page_ids: form.pageIds,
  include_locked: form.includeLocked,
  next_review_date: form.nextReviewDate,
  comment: form.comment.trim(),
});
