/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unwrap } from "@plane/services";
import type { TPageComment, TPageCommentReaction } from "@plane/types";
import { apiClient } from "@/services/api-client";
import { toPageComment, toPageCommentReaction } from "./page-convert";
import type { TPageCommentBody } from "./page-convert";

const pagePath = (slug: string, project_id: string, page_id: string) => ({ path: { slug, project_id, page_id } });
const commentPath = (slug: string, project_id: string, page_id: string, pk: string) => ({
  path: { slug, project_id, page_id, pk },
});

/**
 * REST client for page document/inline comment threads and replies.
 * Errors are thrown as `ApiError` from `@plane/services`.
 */
export class PageCommentService {
  async list(workspaceSlug: string, projectId: string, pageId: string): Promise<TPageComment[]> {
    const comments = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/comments/", {
        params: pagePath(workspaceSlug, projectId, pageId),
      })
    );
    return comments.map(toPageComment);
  }

  async create(
    workspaceSlug: string,
    projectId: string,
    pageId: string,
    data: TPageCommentBody
  ): Promise<TPageComment> {
    const comment = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/comments/", {
        params: pagePath(workspaceSlug, projectId, pageId),
        body: data,
      })
    );
    return toPageComment(comment);
  }

  async update(
    workspaceSlug: string,
    projectId: string,
    pageId: string,
    commentId: string,
    data: TPageCommentBody
  ): Promise<TPageComment> {
    const comment = await unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/comments/{pk}/", {
        params: commentPath(workspaceSlug, projectId, pageId, commentId),
        body: data,
      })
    );
    return toPageComment(comment);
  }

  async destroy(workspaceSlug: string, projectId: string, pageId: string, commentId: string): Promise<void> {
    await unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/comments/{pk}/", {
        params: commentPath(workspaceSlug, projectId, pageId, commentId),
      })
    );
  }

  async resolve(workspaceSlug: string, projectId: string, pageId: string, commentId: string): Promise<TPageComment> {
    const comment = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/comments/{pk}/resolve/", {
        params: commentPath(workspaceSlug, projectId, pageId, commentId),
      })
    );
    return toPageComment(comment);
  }

  async unresolve(workspaceSlug: string, projectId: string, pageId: string, commentId: string): Promise<TPageComment> {
    const comment = await unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/comments/{pk}/resolve/", {
        params: commentPath(workspaceSlug, projectId, pageId, commentId),
      })
    );
    return toPageComment(comment);
  }

  async addReaction(
    workspaceSlug: string,
    projectId: string,
    pageId: string,
    commentId: string,
    reaction: string
  ): Promise<TPageCommentReaction> {
    const created = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/comments/{comment_id}/reactions/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, page_id: pageId, comment_id: commentId } },
        body: { reaction },
      })
    );
    return toPageCommentReaction(created);
  }

  async removeReaction(
    workspaceSlug: string,
    projectId: string,
    pageId: string,
    commentId: string,
    reaction: string
  ): Promise<void> {
    await unwrap(
      apiClient.DELETE(
        "/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/comments/{comment_id}/reactions/{reaction_code}/",
        {
          params: {
            path: {
              slug: workspaceSlug,
              project_id: projectId,
              page_id: pageId,
              comment_id: commentId,
              reaction_code: reaction,
            },
          },
        }
      )
    );
  }
}
