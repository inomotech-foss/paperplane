/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody } from "@plane/api-types";
import { unwrap } from "@plane/services";
import type { TIssueComment } from "@plane/types";
import { apiClient } from "@/services/api-client";
import { fetchWorkItemHistory, isHistoryComment } from "./work-item-history";

export type TIssueCommentWriteBody = ApiRequestBody<
  "/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/comments/",
  "post"
>;

const issuePath = (slug: string, project_id: string, issue_id: string) => ({ path: { slug, project_id, issue_id } });
const commentPath = (slug: string, project_id: string, issue_id: string, pk: string) => ({
  path: { slug, project_id, issue_id, pk },
});

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class IssueCommentService {
  async getIssueComments(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    createdAfter?: string
  ): Promise<TIssueComment[]> {
    const entries = await fetchWorkItemHistory(workspaceSlug, projectId, issueId, "issue-comment", createdAfter);
    return entries.filter(isHistoryComment);
  }

  async createIssueComment(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: TIssueCommentWriteBody
  ): Promise<TIssueComment> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/comments/", {
        params: issuePath(workspaceSlug, projectId, issueId),
        body: data,
      })
    );
  }

  async patchIssueComment(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    commentId: string,
    data: TIssueCommentWriteBody
  ): Promise<TIssueComment> {
    return unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/comments/{pk}/", {
        params: commentPath(workspaceSlug, projectId, issueId, commentId),
        body: data,
      })
    );
  }

  async deleteIssueComment(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    commentId: string
  ): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/comments/{pk}/", {
        params: commentPath(workspaceSlug, projectId, issueId, commentId),
      })
    );
  }
}
