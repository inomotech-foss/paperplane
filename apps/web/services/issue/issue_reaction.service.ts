/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unwrap } from "@plane/services";
import type { TIssueCommentReaction, TIssueReaction } from "@plane/types";
import { apiClient } from "@/services/api-client";

const issuePath = (slug: string, project_id: string, issue_id: string) => ({ path: { slug, project_id, issue_id } });
const commentPath = (slug: string, project_id: string, comment_id: string) => ({
  path: { slug, project_id, comment_id },
});

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class IssueReactionService {
  async createIssueReaction(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    reaction: string
  ): Promise<TIssueReaction> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/reactions/", {
        params: issuePath(workspaceSlug, projectId, issueId),
        body: { reaction },
      })
    );
  }

  async listIssueReactions(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssueReaction[]> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/reactions/", {
        params: issuePath(workspaceSlug, projectId, issueId),
      })
    );
  }

  async deleteIssueReaction(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    reaction: string
  ): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/reactions/{reaction_code}/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, issue_id: issueId, reaction_code: reaction } },
      })
    );
  }

  async createIssueCommentReaction(
    workspaceSlug: string,
    projectId: string,
    commentId: string,
    reaction: string
  ): Promise<TIssueCommentReaction> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/comments/{comment_id}/reactions/", {
        params: commentPath(workspaceSlug, projectId, commentId),
        body: { reaction },
      })
    );
  }

  async listIssueCommentReactions(
    workspaceSlug: string,
    projectId: string,
    commentId: string
  ): Promise<TIssueCommentReaction[]> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/comments/{comment_id}/reactions/", {
        params: commentPath(workspaceSlug, projectId, commentId),
      })
    );
  }

  async deleteIssueCommentReaction(
    workspaceSlug: string,
    projectId: string,
    commentId: string,
    reaction: string
  ): Promise<void> {
    return unwrap(
      apiClient.DELETE(
        "/api/workspaces/{slug}/projects/{project_id}/comments/{comment_id}/reactions/{reaction_code}/",
        {
          params: {
            path: { slug: workspaceSlug, project_id: projectId, comment_id: commentId, reaction_code: reaction },
          },
        }
      )
    );
  }
}
