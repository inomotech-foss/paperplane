// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { unwrap } from "@plane/services";
import type { TIssueRelation, TIssueRelationTypes, TRelatedIssue } from "@plane/types";
import { apiClient } from "@/services/api-client";
import { toRelatedIssue } from "./work-item";

const issuePath = (slug: string, project_id: string, issue_id: string) => ({ path: { slug, project_id, issue_id } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class IssueRelationService {
  async listIssueRelations(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssueRelation> {
    const relations = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/issue-relation/", {
        params: issuePath(workspaceSlug, projectId, issueId),
      })
    );
    return {
      blocking: relations.blocking.map(toRelatedIssue),
      blocked_by: relations.blocked_by.map(toRelatedIssue),
      duplicate: relations.duplicate.map(toRelatedIssue),
      relates_to: relations.relates_to.map(toRelatedIssue),
    };
  }

  async createIssueRelations(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: { relation_type: TIssueRelationTypes; issues: string[] }
  ): Promise<TRelatedIssue[]> {
    const relations = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/issue-relation/", {
        params: issuePath(workspaceSlug, projectId, issueId),
        body: data,
      })
    );
    return relations.map(toRelatedIssue);
  }

  async deleteIssueRelation(workspaceSlug: string, projectId: string, issueId: string, relatedIssueId: string) {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/remove-relation/", {
        params: issuePath(workspaceSlug, projectId, issueId),
        body: { related_issue: relatedIssueId },
      })
    );
  }
}
