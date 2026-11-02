// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { isApiError } from "@plane/services";
import type { TIssue, TIssuePriorities, TStateGroups } from "@plane/types";
import { readField } from "@plane/types";

/** A change asked for in the bulk operations bar. Assignees and labels are added, the rest is set. */
export type TBulkChange =
  | { type: "state"; stateId: string }
  | { type: "priority"; priority: TIssuePriorities }
  | { type: "assignee"; memberId: string }
  | { type: "label"; labelId: string }
  | { type: "start_date"; date: string | null }
  | { type: "target_date"; date: string | null };

export type TBulkUpdatePayload = { data: Partial<TIssue> } | { skip: "unchanged" | "invalid_dates" };

const addId = (ids: string[], id: string): string[] | undefined => (ids.includes(id) ? undefined : [...ids, id]);

/** What one work item needs for a change: the PATCH data, or why it is skipped. Dates are YYYY-MM-DD. */
export const getBulkUpdatePayload = (issue: TIssue, change: TBulkChange): TBulkUpdatePayload => {
  switch (change.type) {
    case "state":
      return issue.state_id === change.stateId ? { skip: "unchanged" } : { data: { state_id: change.stateId } };
    case "priority":
      return issue.priority === change.priority ? { skip: "unchanged" } : { data: { priority: change.priority } };
    case "assignee": {
      const assignee_ids = addId(issue.assignee_ids, change.memberId);
      return assignee_ids ? { data: { assignee_ids } } : { skip: "unchanged" };
    }
    case "label": {
      const label_ids = addId(issue.label_ids, change.labelId);
      return label_ids ? { data: { label_ids } } : { skip: "unchanged" };
    }
    case "start_date":
      if (issue.start_date === change.date) return { skip: "unchanged" };
      if (change.date && issue.target_date && change.date > issue.target_date) return { skip: "invalid_dates" };
      return { data: { start_date: change.date } };
    case "target_date":
      if (issue.target_date === change.date) return { skip: "unchanged" };
      if (change.date && issue.start_date && change.date < issue.start_date) return { skip: "invalid_dates" };
      return { data: { target_date: change.date } };
  }
};

export type TBulkUpdateResult = { updated: number; failed: number; invalidDates: number };

/** At most this many updates are in flight at once. */
export const BULK_UPDATE_CONCURRENCY = 5;

/** Updates each work item that the change applies to, a few at a time, and counts the outcomes. */
export const applyBulkChange = async (
  issues: TIssue[],
  change: TBulkChange,
  update: (issue: TIssue, data: Partial<TIssue>) => Promise<void>
): Promise<TBulkUpdateResult> => {
  const result: TBulkUpdateResult = { updated: 0, failed: 0, invalidDates: 0 };
  const queue: { issue: TIssue; data: Partial<TIssue> }[] = [];
  for (const issue of issues) {
    const payload = getBulkUpdatePayload(issue, change);
    if ("data" in payload) queue.push({ issue, data: payload.data });
    else if (payload.skip === "invalid_dates") result.invalidDates += 1;
  }
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      try {
        await update(next.issue, next.data);
        result.updated += 1;
      } catch (error) {
        console.error(error);
        result.failed += 1;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(BULK_UPDATE_CONCURRENCY, queue.length) }, worker));
  return result;
};

const INVALID_ARCHIVE_STATE_GROUP = 4091;

export type TArchiveFailure = "state_group" | "permission" | "other";

/** Why a bulk archive failed, from the API error. */
export const getArchiveFailure = (error: unknown): TArchiveFailure => {
  if (!isApiError(error)) return "other";
  if (readField(error.data, "error_code") === INVALID_ARCHIVE_STATE_GROUP) return "state_group";
  return error.status === 403 ? "permission" : "other";
};

const ARCHIVABLE_GROUPS: ReadonlySet<TStateGroups> = new Set<TStateGroups>(["completed", "cancelled"]);

/** The API archives only work items in a completed or cancelled state, and refuses the whole batch otherwise. */
export const canArchiveAll = (groups: (TStateGroups | undefined)[]): boolean =>
  groups.length > 0 && groups.every((group) => group !== undefined && ARCHIVABLE_GROUPS.has(group));
