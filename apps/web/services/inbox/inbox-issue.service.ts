// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ApiRequestBody, ApiSchema, InternalPaths } from "@plane/api-types";
import { unwrap } from "@plane/services";
import type { TInboxIssue, TInboxIssueWithPagination, TIssue, TIssueRow } from "@plane/types";
import { EInboxIssueSource, EInboxIssueStatus } from "@plane/types";
import { findLiteral, getField } from "@/helpers/narrow.helper";
import { apiClient } from "@/services/api-client";
import { toBaseIssue } from "@/services/issue/work-item";

const LIST_PATH = "/api/workspaces/{slug}/projects/{project_id}/inbox-issues/";

export type TInboxIssueListQuery = NonNullable<InternalPaths[typeof LIST_PATH]["get"]["parameters"]["query"]>;
export type TInboxIssueCreateBody = ApiRequestBody<typeof LIST_PATH, "post">;
export type TInboxIssueUpdateBody = ApiRequestBody<
  "/api/workspaces/{slug}/projects/{project_id}/inbox-issues/{pk}/",
  "patch"
>;
/** An intake work item from the detail endpoints, which send the whole work item. */
export type TInboxIssueDetail = TInboxIssue & { issue: TIssueRow };

/** The intake fields of an update. A `snoozed_till` of YYYY-MM-DD is read as a day in the project timezone. */
export type TInboxIssueStatusUpdate = Pick<TInboxIssueUpdateBody, "status" | "duplicate_to" | "snoozed_till">;

const STATUS: Record<ApiSchema<"IntakeWorkItemStatusEnum">, EInboxIssueStatus> = {
  [-2]: EInboxIssueStatus.PENDING,
  [-1]: EInboxIssueStatus.DECLINED,
  [0]: EInboxIssueStatus.SNOOZED,
  [1]: EInboxIssueStatus.ACCEPTED,
  [2]: EInboxIssueStatus.DUPLICATE,
};

const SOURCES = Object.values(EInboxIssueSource);

const toSource = (source: string | null): EInboxIssueSource | undefined =>
  source === null ? undefined : findLiteral(SOURCES, source);

const toDate = (value: string | null): Date | null => (value === null ? null : new Date(value));

const toDetailIssue = (issue: ApiSchema<"IssueDetail">): TIssueRow => ({
  ...toBaseIssue(issue),
  description_html: issue.description_html,
  ...(issue.is_subscribed === undefined ? {} : { is_subscribed: issue.is_subscribed }),
});

export const toInboxIssue = (item: ApiSchema<"IntakeIssue">): TInboxIssue => ({
  id: item.id,
  status: STATUS[item.status],
  snoozed_till: toDate(item.snoozed_till),
  duplicate_to: item.duplicate_to ?? undefined,
  source: toSource(item.source),
  issue: { ...item.issue },
  created_by: item.created_by ?? undefined,
  duplicate_issue_detail: undefined,
});

export const toInboxIssueDetail = (item: ApiSchema<"IntakeIssueDetail">): TInboxIssueDetail => ({
  id: item.id,
  status: STATUS[item.status],
  snoozed_till: toDate(item.snoozed_till),
  duplicate_to: item.duplicate_to ?? undefined,
  source: toSource(item.source),
  issue: toDetailIssue(item.issue),
  created_by: undefined,
  duplicate_issue_detail: item.duplicate_issue_detail ?? undefined,
});

/** The work item fields the intake create and update write. */
const issueFields = (data: Partial<TIssue>) => ({
  name: data.name,
  description_html: data.description_html,
  priority: data.priority ?? undefined,
  state_id: data.state_id,
  parent_id: data.parent_id,
  type_id: data.type_id,
  label_ids: data.label_ids,
  assignee_ids: data.assignee_ids,
  start_date: data.start_date,
  target_date: data.target_date,
  estimate_point: data.estimate_point,
});

/** The backend always puts a new intake work item in the triage state. */
export const inboxIssueCreateBody = (data: Partial<TIssue>): TInboxIssueCreateBody => ({
  issue: { ...issueFields(data), state_id: undefined, name: data.name ?? "", type_id: data.type_id ?? "" },
});

/**
 * Editors pass `skip_activity` next to the work item fields for a description migration. The API reads it next to
 * `issue`.
 */
export const inboxIssueUpdateBody = (data: Partial<TIssue>): TInboxIssueUpdateBody => {
  const skipActivity = getField(data, "skip_activity");
  return {
    issue: issueFields(data),
    ...(skipActivity === true || skipActivity === "true" ? { skip_activity: true } : {}),
  };
};

const projectPath = (slug: string, project_id: string) => ({ path: { slug, project_id } });
const itemPath = (slug: string, project_id: string, pk: string) => ({ path: { slug, project_id, pk } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class InboxIssueService {
  async list(
    workspaceSlug: string,
    projectId: string,
    query: TInboxIssueListQuery
  ): Promise<TInboxIssueWithPagination> {
    const { results, ...pagination } = await unwrap(
      apiClient.GET(LIST_PATH, { params: { ...projectPath(workspaceSlug, projectId), query } })
    );
    return { ...pagination, results: results.map(toInboxIssue) };
  }

  async retrieve(workspaceSlug: string, projectId: string, inboxIssueId: string): Promise<TInboxIssueDetail> {
    return toInboxIssueDetail(
      await unwrap(
        apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/inbox-issues/{pk}/", {
          params: itemPath(workspaceSlug, projectId, inboxIssueId),
        })
      )
    );
  }

  async create(workspaceSlug: string, projectId: string, data: Partial<TIssue>): Promise<TInboxIssueDetail> {
    return toInboxIssueDetail(
      await unwrap(
        apiClient.POST(LIST_PATH, { params: projectPath(workspaceSlug, projectId), body: inboxIssueCreateBody(data) })
      )
    );
  }

  async update(
    workspaceSlug: string,
    projectId: string,
    inboxIssueId: string,
    data: TInboxIssueStatusUpdate
  ): Promise<TInboxIssueDetail> {
    return toInboxIssueDetail(
      await unwrap(
        apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/inbox-issues/{pk}/", {
          params: itemPath(workspaceSlug, projectId, inboxIssueId),
          body: data,
        })
      )
    );
  }

  async updateIssue(
    workspaceSlug: string,
    projectId: string,
    inboxIssueId: string,
    data: Partial<TIssue>
  ): Promise<TInboxIssueDetail> {
    return toInboxIssueDetail(
      await unwrap(
        apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/inbox-issues/{pk}/", {
          params: itemPath(workspaceSlug, projectId, inboxIssueId),
          body: inboxIssueUpdateBody(data),
        })
      )
    );
  }

  async destroy(workspaceSlug: string, projectId: string, inboxIssueId: string): Promise<void> {
    await unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/inbox-issues/{pk}/", {
        params: itemPath(workspaceSlug, projectId, inboxIssueId),
      })
    );
  }
}
