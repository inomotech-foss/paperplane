// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { InternalPaths } from "@plane/api-types";
import type { TIssueParams, TProjectIssuesSearchParams } from "@plane/types";

type TListOperation = InternalPaths["/api/workspaces/{slug}/projects/{project_id}/issues/"]["get"];

/** The query of the work item list endpoints. */
export type TIssueListQuery = NonNullable<TListOperation["parameters"]["query"]>;

/** What the stores build: every value as a string, except boolean toggles. */
export type TIssueParamsRecord = Partial<Record<TIssueParams, string | boolean>>;

type TGroupBy = NonNullable<TIssueListQuery["group_by"]>;

const GROUP_BY_FIELDS: readonly TGroupBy[] = [
  "state_id",
  "state__group",
  "priority",
  "labels__id",
  "assignees__id",
  "cycle_id",
  "issue_module__module_id",
  "target_date",
  "start_date",
  "project_id",
  "created_by",
];

const isGroupBy = (value: unknown): value is TGroupBy => GROUP_BY_FIELDS.some((field) => field === value);

const STRING_KEYS = [
  "cursor",
  "order_by",
  "filters",
  "pql",
  "layout",
  "state",
  "state_group",
  "priority",
  "labels",
  "assignees",
  "mentions",
  "created_by",
  "subscriber",
  "cycle",
  "module",
  "project",
  "start_date",
  "target_date",
] as const satisfies readonly (TIssueParams & keyof TIssueListQuery)[];

/** Converts the params a store builds to the documented list query. Keys the endpoints do not read are dropped. */
export function toIssueListQuery(params: TIssueParamsRecord | undefined): TIssueListQuery {
  const query: TIssueListQuery = {};
  if (!params) return query;
  for (const key of STRING_KEYS) {
    const value = params[key];
    if (value !== undefined) query[key] = String(value);
  }
  if (isGroupBy(params.group_by)) query.group_by = params.group_by;
  if (isGroupBy(params.sub_group_by)) query.sub_group_by = params.sub_group_by;
  const perPage = Number(params.per_page);
  if (params.per_page !== undefined && Number.isFinite(perPage)) query.per_page = perPage;
  if (params.sub_issue !== undefined) query.sub_issue = params.sub_issue === true || params.sub_issue === "true";
  return query;
}

/** Whether a list request needs the detail endpoint, which embeds the relations a timeline draws. */
export const wantsRelations = (params: TIssueParamsRecord | undefined): boolean =>
  typeof params?.expand === "string" && params.expand.includes("issue_relation") && !params.group_by;

type TSearchOperation = InternalPaths["/api/workspaces/{slug}/projects/{project_id}/search-issues/"]["get"];
type TIssueSearchQuery = NonNullable<TSearchOperation["parameters"]["query"]>;

const flag = (value: boolean | undefined): "true" | "false" | undefined =>
  value === undefined ? undefined : value ? "true" : "false";

/** The search endpoint reads its flags as the strings true and false. */
export const toIssueSearchQuery = (params: TProjectIssuesSearchParams): TIssueSearchQuery => ({
  search: params.search,
  workspace_search: flag(params.workspace_search),
  parent: flag(params.parent),
  issue_relation: flag(params.issue_relation),
  cycle: flag(params.cycle),
  sub_issue: flag(params.sub_issue),
  has_children: flag(params.has_children),
  module: params.module,
  issue_id: params.issue_id,
  target_date: params.target_date,
  limit: params.limit,
});

type TWorkspaceListOperation = InternalPaths["/api/workspaces/{slug}/issues/"]["get"];
type TWorkspaceIssueListQuery = NonNullable<TWorkspaceListOperation["parameters"]["query"]>;

/** The list query of a workspace view, which is never grouped. */
export function toWorkspaceIssueListQuery(params: TIssueParamsRecord | undefined): TWorkspaceIssueListQuery {
  const { group_by: _groupBy, sub_group_by: _subGroupBy, ...query } = toIssueListQuery(params);
  return query;
}
