// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ApiRequestBody, ApiSchema } from "@plane/api-types";
import { parseLogoProps } from "@plane/types";
import type {
  ICycle,
  TCycleDistribution,
  TCycleEstimateDistribution,
  TCycleGroups,
  TProgressSnapshot,
} from "@plane/types";

type TCycleRow =
  | ApiSchema<"Cycle">
  | ApiSchema<"CycleListItem">
  | ApiSchema<"CycleDetail">
  | ApiSchema<"CycleSnapshot">
  | ApiSchema<"ArchivedCycleListItem">
  | ApiSchema<"ArchivedCycleDetail">;

export type TCycleWriteBody = ApiRequestBody<"/api/workspaces/{slug}/projects/{project_id}/cycles/{pk}/", "patch">;
export type TCycleCreateBody = ApiRequestBody<"/api/workspaces/{slug}/projects/{project_id}/cycles/", "post">;

const STATUSES: Record<ApiSchema<"CycleStatusEnum">, TCycleGroups> = {
  CURRENT: "current",
  UPCOMING: "upcoming",
  COMPLETED: "completed",
  DRAFT: "draft",
};

type TDistributionCounts = { total_issues?: number; completed_issues?: number; pending_issues?: number };
type TDistributionEstimates = {
  total_estimates?: number | null;
  completed_estimates?: number | null;
  pending_estimates?: number | null;
};

const issueCounts = (row: TDistributionCounts) => ({
  total_issues: row.total_issues ?? 0,
  completed_issues: row.completed_issues ?? 0,
  pending_issues: row.pending_issues ?? 0,
});

const estimateSums = (row: TDistributionEstimates) => ({
  total_estimates: row.total_estimates ?? 0,
  completed_estimates: row.completed_estimates ?? 0,
  pending_estimates: row.pending_estimates ?? 0,
});

const toAssignee = (row: ApiSchema<"AssigneeDistribution">) => ({
  assignee_id: row.assignee_id,
  avatar_url: row.avatar_url,
  display_name: row.display_name,
  first_name: row.first_name ?? null,
  last_name: row.last_name ?? null,
});

const toLabel = (row: ApiSchema<"LabelDistribution">) => ({
  label_id: row.label_id,
  label_name: row.label_name,
  color: row.color,
});

const assigneeIssues = (row: ApiSchema<"AssigneeDistribution">) => Object.assign(toAssignee(row), issueCounts(row));
const labelIssues = (row: ApiSchema<"LabelDistribution">) => Object.assign(toLabel(row), issueCounts(row));
const assigneeEstimates = (row: ApiSchema<"AssigneeDistribution">) => Object.assign(toAssignee(row), estimateSums(row));
const labelEstimates = (row: ApiSchema<"LabelDistribution">) => Object.assign(toLabel(row), estimateSums(row));

/** The work item counts per assignee, label and day. */
export const toCycleDistribution = (distribution: ApiSchema<"Distribution">): TCycleDistribution => ({
  assignees: distribution.assignees.map(assigneeIssues),
  labels: distribution.labels.map(labelIssues),
  completion_chart: distribution.completion_chart,
});

/** The estimate sums per assignee, label and day of the analytics endpoint. */
export const toCycleEstimateSums = (distribution: ApiSchema<"Distribution">): TCycleEstimateDistribution => ({
  assignees: distribution.assignees.map(assigneeEstimates),
  labels: distribution.labels.map(labelEstimates),
  completion_chart: distribution.completion_chart,
});

/**
 * The estimate sums of a snapshot or a detail. The backend sends an empty object when the project does not estimate
 * in points, which gives undefined.
 */
export const toCycleEstimateDistribution = (
  distribution: ApiSchema<"EstimateDistribution">
): TCycleEstimateDistribution | undefined => {
  if (!distribution.assignees && !distribution.labels && !distribution.completion_chart) return undefined;
  return {
    assignees: (distribution.assignees ?? []).map(assigneeEstimates),
    labels: (distribution.labels ?? []).map(labelEstimates),
    completion_chart: distribution.completion_chart ?? {},
  };
};

/** The snapshot keeps only the keys the backend stored. An empty object means no snapshot. */
export function toProgressSnapshot(snapshot: ApiSchema<"ProgressSnapshot">): Partial<TProgressSnapshot> {
  const result: Partial<TProgressSnapshot> = {};
  if (snapshot.total_issues !== undefined) result.total_issues = snapshot.total_issues;
  if (snapshot.completed_issues !== undefined) result.completed_issues = snapshot.completed_issues;
  if (snapshot.cancelled_issues !== undefined) result.cancelled_issues = snapshot.cancelled_issues;
  if (snapshot.started_issues !== undefined) result.started_issues = snapshot.started_issues;
  if (snapshot.unstarted_issues !== undefined) result.unstarted_issues = snapshot.unstarted_issues;
  if (snapshot.backlog_issues !== undefined) result.backlog_issues = snapshot.backlog_issues;
  if (snapshot.total_estimate_points !== undefined) result.total_estimate_points = snapshot.total_estimate_points;
  if (snapshot.completed_estimate_points !== undefined)
    result.completed_estimate_points = snapshot.completed_estimate_points;
  if (snapshot.cancelled_estimate_points !== undefined)
    result.cancelled_estimate_points = snapshot.cancelled_estimate_points;
  if (snapshot.started_estimate_points !== undefined) result.started_estimate_points = snapshot.started_estimate_points;
  if (snapshot.unstarted_estimate_points !== undefined)
    result.unstarted_estimate_points = snapshot.unstarted_estimate_points;
  if (snapshot.backlog_estimate_points !== undefined) result.backlog_estimate_points = snapshot.backlog_estimate_points;
  if (snapshot.distribution) result.distribution = toCycleDistribution(snapshot.distribution);
  const estimates = snapshot.estimate_distribution && toCycleEstimateDistribution(snapshot.estimate_distribution);
  if (estimates) result.estimate_distribution = estimates;
  return result;
}

/** A cycle row of any cycle endpoint. Fields the endpoint does not send stay out, so store merges keep them. */
export function toCycle(row: TCycleRow): ICycle {
  const cycle: ICycle = {
    id: row.id,
    workspace_id: row.workspace_id,
    project_id: row.project_id,
    name: row.name,
    description: row.description,
    start_date: row.start_date,
    end_date: row.end_date,
    owned_by_id: row.owned_by_id,
    sort_order: row.sort_order,
    progress_snapshot: toProgressSnapshot(row.progress_snapshot),
  };
  if (row.status !== undefined) cycle.status = STATUSES[row.status];
  if ("logo_props" in row) cycle.logo_props = parseLogoProps(row.logo_props);
  if (row.is_favorite !== undefined) cycle.is_favorite = row.is_favorite;
  if (row.total_issues !== undefined) cycle.total_issues = row.total_issues;
  if ("cancelled_issues" in row && row.cancelled_issues !== undefined) cycle.cancelled_issues = row.cancelled_issues;
  if (row.completed_issues !== undefined) cycle.completed_issues = row.completed_issues;
  if ("assignee_ids" in row) cycle.assignee_ids = row.assignee_ids;
  if ("version" in row) cycle.version = row.version;
  if ("created_by" in row) cycle.created_by = row.created_by;
  if ("sub_issues" in row) cycle.sub_issues = row.sub_issues;
  if ("started_issues" in row && row.started_issues !== undefined) cycle.started_issues = row.started_issues ?? 0;
  if ("unstarted_issues" in row && row.unstarted_issues !== undefined)
    cycle.unstarted_issues = row.unstarted_issues ?? 0;
  if ("backlog_issues" in row && row.backlog_issues !== undefined) cycle.backlog_issues = row.backlog_issues ?? 0;
  if ("archived_at" in row) cycle.archived_at = row.archived_at;
  if ("total_estimate_points" in row) cycle.total_estimate_points = row.total_estimate_points ?? 0;
  if ("completed_estimate_points" in row) cycle.completed_estimate_points = row.completed_estimate_points ?? 0;
  if ("distribution" in row) cycle.distribution = toCycleDistribution(row.distribution);
  if ("estimate_distribution" in row)
    cycle.estimate_distribution = toCycleEstimateDistribution(row.estimate_distribution);
  return cycle;
}

/** The fields of `data` a cycle write accepts. */
export const toCycleWriteBody = (data: Partial<ICycle>): TCycleWriteBody => ({
  name: data.name,
  description: data.description,
  start_date: data.start_date,
  end_date: data.end_date,
  sort_order: data.sort_order,
  logo_props: data.logo_props,
});

export const toCycleCreateBody = (data: Partial<ICycle>): TCycleCreateBody => ({
  ...toCycleWriteBody(data),
  name: data.name ?? "",
});

/** The counts and estimate sums of the progress endpoint. */
export const toCycleProgress = (progress: ApiSchema<"CycleProgress">): TProgressSnapshot => ({
  total_issues: progress.total_issues,
  completed_issues: progress.completed_issues,
  cancelled_issues: progress.cancelled_issues,
  started_issues: progress.started_issues,
  unstarted_issues: progress.unstarted_issues,
  backlog_issues: progress.backlog_issues,
  total_estimate_points: progress.total_estimate_points,
  completed_estimate_points: progress.completed_estimate_points,
  cancelled_estimate_points: progress.cancelled_estimate_points,
  started_estimate_points: progress.started_estimate_points,
  unstarted_estimate_points: progress.unstarted_estimate_points,
  backlog_estimate_points: progress.backlog_estimate_points,
});
