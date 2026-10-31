// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { unwrap } from "@plane/services";
import type { TIssue, TIssuesResponse } from "@plane/types";
import { apiClient } from "@/services/api-client";
import { toIssueListQuery } from "./issue-query";
import type { TIssueParamsRecord } from "./issue-query";
import type { TRequestOptions } from "./issue.service";
import { toIssue, toIssuesResponse } from "./work-item";

const issuePath = (slug: string, project_id: string, pk: string) => ({ path: { slug, project_id, pk } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class IssueArchiveService {
  async getArchivedIssues(
    workspaceSlug: string,
    projectId: string,
    queries?: TIssueParamsRecord,
    options: TRequestOptions = {}
  ): Promise<TIssuesResponse> {
    const page = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/archived-issues/", {
        params: { path: { slug: workspaceSlug, project_id: projectId }, query: toIssueListQuery(queries) },
        ...options,
      })
    );
    return toIssuesResponse(page);
  }

  async archiveIssue(workspaceSlug: string, projectId: string, issueId: string): Promise<{ archived_at: string }> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/issues/{pk}/archive/", {
        params: issuePath(workspaceSlug, projectId, issueId),
      })
    );
  }

  async restoreIssue(workspaceSlug: string, projectId: string, issueId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/issues/{pk}/archive/", {
        params: issuePath(workspaceSlug, projectId, issueId),
      })
    );
  }

  async retrieveArchivedIssue(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssue> {
    const detail = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issues/{pk}/archive/", {
        params: issuePath(workspaceSlug, projectId, issueId),
      })
    );
    return toIssue(detail);
  }
}
