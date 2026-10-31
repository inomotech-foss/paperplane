/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody, ApiResponse } from "@plane/api-types";
import { unwrap } from "@plane/services";
import type { TIssueParams } from "@plane/types";
import { apiClient } from "@/services/api-client";
import { parsePublicComment, parsePublicComments } from "@/services/public-comment";
import type { TPublicComment } from "@/services/public-comment";
import { sendJson } from "@/services/send-json";

export type TPublicIssueListParams = Partial<Record<TIssueParams, string | boolean>>;
export type TPublicIssueList = ApiResponse<"/api/public/anchor/{anchor}/issues/", "get">;
export type TPublicIssueDetail = ApiResponse<"/api/public/anchor/{anchor}/issues/{issue_id}/", "get">;
export type TPublicCommentBody = ApiRequestBody<"/api/public/anchor/{anchor}/issues/{issue_id}/comments/", "post">;

export const serializeQuery = (params: TPublicIssueListParams): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.append(key, String(value));
  }
  return search.toString();
};

const issuePath = (anchor: string, issue_id: string) => ({ path: { anchor, issue_id } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class PublicIssueService {
  async list(anchor: string, params: TPublicIssueListParams): Promise<TPublicIssueList> {
    // The schema lists only cursor and per_page. The view also reads the filter and grouping params.
    return unwrap(
      apiClient.GET("/api/public/anchor/{anchor}/issues/", {
        params: { path: { anchor } },
        querySerializer: () => serializeQuery(params),
      })
    );
  }

  async retrieve(anchor: string, issueId: string): Promise<TPublicIssueDetail> {
    return unwrap(
      apiClient.GET("/api/public/anchor/{anchor}/issues/{issue_id}/", { params: issuePath(anchor, issueId) })
    );
  }

  /** The schema has no request body for this operation. */
  async addVote(anchor: string, issueId: string, data: { vote: 1 | -1 }): Promise<void> {
    await sendJson(`/api/public/anchor/${anchor}/issues/${issueId}/votes/`, data);
  }

  async removeVote(anchor: string, issueId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/public/anchor/{anchor}/issues/{issue_id}/votes/", { params: issuePath(anchor, issueId) })
    );
  }

  async addReaction(anchor: string, issueId: string, data: { reaction: string }): Promise<void> {
    await unwrap(
      apiClient.POST("/api/public/anchor/{anchor}/issues/{issue_id}/reactions/", {
        params: issuePath(anchor, issueId),
        body: data,
      })
    );
  }

  async removeReaction(anchor: string, issueId: string, reactionCode: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/public/anchor/{anchor}/issues/{issue_id}/reactions/{reaction_code}/", {
        params: { path: { anchor, issue_id: issueId, reaction_code: reactionCode } },
      })
    );
  }

  async listComments(anchor: string, issueId: string): Promise<TPublicComment[]> {
    const data = await unwrap(
      apiClient.GET("/api/public/anchor/{anchor}/issues/{issue_id}/comments/", {
        params: issuePath(anchor, issueId),
      })
    );
    return parsePublicComments(data);
  }

  async addComment(anchor: string, issueId: string, data: TPublicCommentBody): Promise<TPublicComment> {
    const comment = await unwrap(
      apiClient.POST("/api/public/anchor/{anchor}/issues/{issue_id}/comments/", {
        params: issuePath(anchor, issueId),
        body: data,
      })
    );
    return parsePublicComment(comment);
  }

  async updateComment(anchor: string, issueId: string, commentId: string, data: TPublicCommentBody): Promise<void> {
    await unwrap(
      apiClient.PATCH("/api/public/anchor/{anchor}/issues/{issue_id}/comments/{pk}/", {
        params: { path: { anchor, issue_id: issueId, pk: commentId } },
        body: data,
      })
    );
  }

  async removeComment(anchor: string, issueId: string, commentId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/public/anchor/{anchor}/issues/{issue_id}/comments/{pk}/", {
        params: { path: { anchor, issue_id: issueId, pk: commentId } },
      })
    );
  }

  async addCommentReaction(anchor: string, commentId: string, data: { reaction: string }): Promise<void> {
    await unwrap(
      apiClient.POST("/api/public/anchor/{anchor}/comments/{comment_id}/reactions/", {
        params: { path: { anchor, comment_id: commentId } },
        body: data,
      })
    );
  }

  async removeCommentReaction(anchor: string, commentId: string, reactionCode: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/public/anchor/{anchor}/comments/{comment_id}/reactions/{reaction_code}/", {
        params: { path: { anchor, comment_id: commentId, reaction_code: reactionCode } },
      })
    );
  }
}
