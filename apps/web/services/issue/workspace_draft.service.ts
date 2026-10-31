// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ApiRequestBody, ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import type { TIssue, TIssueRow, TWorkspaceDraftIssue, TWorkspaceDraftPaginationInfo } from "@plane/types";
import { apiClient } from "@/services/api-client";
import { toBaseIssue, toIssuePriority } from "./work-item";

export type TDraftIssueBody = ApiRequestBody<"/api/workspaces/{slug}/draft-issues/", "post">;
export type TDraftToIssueBody = ApiRequestBody<"/api/workspaces/{slug}/draft-to-issue/{draft_id}/", "post">;
export type TDraftListQuery = { per_page?: number; cursor?: string };

type TDraftRow = ApiSchema<"DraftIssue"> | ApiSchema<"DraftIssueDetail"> | ApiSchema<"DraftWorkItemSnapshot">;

/** A draft row of the API as the draft store keeps it. */
export function toDraftIssue(row: TDraftRow): TWorkspaceDraftIssue {
  return {
    id: row.id,
    name: row.name ?? "",
    sort_order: row.sort_order,
    state_id: row.state_id ?? undefined,
    priority: toIssuePriority(row.priority) ?? undefined,
    label_ids: row.label_ids ?? [],
    assignee_ids: row.assignee_ids ?? [],
    estimate_point: row.estimate_point,
    project_id: row.project_id ?? undefined,
    parent_id: row.parent_id ?? undefined,
    cycle_id: row.cycle_id ?? undefined,
    module_ids: row.module_ids,
    start_date: row.start_date ?? undefined,
    target_date: row.target_date ?? undefined,
    completed_at: row.completed_at ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
    is_draft: true,
    type_id: row.type_id,
    description_html: row.description_html,
  };
}

type TDraftPayload = Partial<TWorkspaceDraftIssue | TIssue>;

const orNull = <T>(value: T | null | undefined): T | null | undefined => value;

/** The writable draft fields of a store payload. Drafts model empty fields as undefined, the API as null. */
export function toDraftIssueBody(payload: TDraftPayload): TDraftIssueBody {
  const body: TDraftIssueBody = {};
  if (payload.name !== undefined) body.name = payload.name;
  if (payload.description_html !== undefined) body.description_html = payload.description_html;
  if (payload.label_ids !== undefined) body.label_ids = payload.label_ids;
  if (payload.assignee_ids !== undefined) body.assignee_ids = payload.assignee_ids;
  if (payload.estimate_point !== undefined) body.estimate_point = payload.estimate_point;
  if (payload.sort_order !== undefined) body.sort_order = payload.sort_order;
  if (payload.priority) body.priority = payload.priority;
  if ("state_id" in payload) body.state_id = orNull(payload.state_id) ?? null;
  if ("parent_id" in payload) body.parent_id = orNull(payload.parent_id) ?? null;
  if ("project_id" in payload) body.project_id = orNull(payload.project_id) ?? null;
  if ("cycle_id" in payload) body.cycle_id = orNull(payload.cycle_id) ?? null;
  if ("type_id" in payload) body.type_id = orNull(payload.type_id) ?? null;
  if ("start_date" in payload) body.start_date = orNull(payload.start_date) ?? null;
  if ("target_date" in payload) body.target_date = orNull(payload.target_date) ?? null;
  if (payload.module_ids) body.module_ids = payload.module_ids;
  return body;
}

/** A draft as a work item create body. The API rejects a work item without a type. */
export function toDraftToIssueBody(payload: TDraftPayload): TDraftToIssueBody {
  const { type_id: typeId } = payload;
  if (!typeId) throw new Error("A work item needs a type");
  const { project_id: _project, ...body } = toDraftIssueBody(payload);
  return { ...body, name: payload.name ?? "", type_id: typeId };
}

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class WorkspaceDraftService {
  async getIssues(
    workspaceSlug: string,
    query: TDraftListQuery = {}
  ): Promise<TWorkspaceDraftPaginationInfo<TWorkspaceDraftIssue>> {
    const page = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/draft-issues/", { params: { path: { slug: workspaceSlug }, query } })
    );
    return {
      next_cursor: page.next_cursor,
      prev_cursor: page.prev_cursor,
      next_page_results: page.next_page_results,
      prev_page_results: page.prev_page_results,
      total_pages: page.total_pages,
      count: page.count,
      total_count: page.total_count,
      total_results: page.total_results,
      results: page.results.map(toDraftIssue),
      grouped_by: page.grouped_by ?? undefined,
      sub_grouped_by: page.sub_grouped_by ?? undefined,
    };
  }

  async getIssueById(workspaceSlug: string, issueId: string): Promise<TWorkspaceDraftIssue> {
    const draft = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/draft-issues/{pk}/", {
        params: { path: { slug: workspaceSlug, pk: issueId } },
      })
    );
    return toDraftIssue(draft);
  }

  async createIssue(workspaceSlug: string, payload: TDraftPayload): Promise<TWorkspaceDraftIssue> {
    const draft = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/draft-issues/", {
        params: { path: { slug: workspaceSlug } },
        body: toDraftIssueBody(payload),
      })
    );
    return toDraftIssue(draft);
  }

  async updateIssue(workspaceSlug: string, issueId: string, payload: TDraftPayload): Promise<void> {
    return unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/draft-issues/{pk}/", {
        params: { path: { slug: workspaceSlug, pk: issueId } },
        body: toDraftIssueBody(payload),
      })
    );
  }

  async deleteIssue(workspaceSlug: string, issueId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/draft-issues/{pk}/", {
        params: { path: { slug: workspaceSlug, pk: issueId } },
      })
    );
  }

  async moveIssue(workspaceSlug: string, issueId: string, payload: TDraftPayload): Promise<TIssueRow> {
    const issue = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/draft-to-issue/{draft_id}/", {
        params: { path: { slug: workspaceSlug, draft_id: issueId } },
        body: toDraftToIssueBody(payload),
      })
    );
    return toBaseIssue(issue);
  }
}

const workspaceDraftService = new WorkspaceDraftService();

export default workspaceDraftService;
