/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { pull, concat, update, uniq, set } from "lodash-es";
import { action, makeObservable, observable, runInAction } from "mobx";
// Plane Imports
import type { TIssueComment, TIssueCommentMap, TIssueCommentIdMap, TIssueServiceType } from "@plane/types";
// services
import { IssueCommentService } from "@/services/issue";
import type { TIssueCommentWriteBody } from "@/services/issue";
// types
import type { IIssueDetail } from "./root.store";

export type TCommentLoader = "fetch" | "create" | "update" | "delete" | "mutate" | undefined;

export interface IIssueCommentStoreActions {
  fetchComments: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    loaderType?: TCommentLoader
  ) => Promise<TIssueComment[]>;
  createComment: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: TIssueCommentWriteBody
  ) => Promise<TIssueComment>;
  updateComment: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    commentId: string,
    data: TIssueCommentWriteBody
  ) => Promise<TIssueComment>;
  removeComment: (workspaceSlug: string, projectId: string, issueId: string, commentId: string) => Promise<void>;
}

export interface IIssueCommentStore extends IIssueCommentStoreActions {
  // observables
  loader: TCommentLoader;
  comments: TIssueCommentIdMap;
  commentMap: TIssueCommentMap;
  // helper methods
  getCommentsByIssueId: (issueId: string) => string[] | undefined;
  getCommentById: (activityId: string) => TIssueComment | undefined;
}

export class IssueCommentStore implements IIssueCommentStore {
  // observables
  loader: TCommentLoader = "fetch";
  comments: TIssueCommentIdMap = {};
  commentMap: TIssueCommentMap = {};
  serviceType;
  // root store
  rootIssueDetail: IIssueDetail;
  // services
  issueCommentService;

  constructor(rootStore: IIssueDetail, serviceType: TIssueServiceType) {
    makeObservable(this, {
      // observables
      loader: observable.ref,
      comments: observable,
      commentMap: observable,
      // actions
      fetchComments: action,
      createComment: action,
      updateComment: action,
      removeComment: action,
    });
    // root store
    this.serviceType = serviceType;
    this.rootIssueDetail = rootStore;
    // services
    this.issueCommentService = new IssueCommentService();
  }

  // helper methods
  getCommentsByIssueId = (issueId: string) => {
    if (!issueId) return undefined;
    return this.comments[issueId] ?? undefined;
  };

  getCommentById = (commentId: string) => {
    if (!commentId) return undefined;
    return this.commentMap[commentId] ?? undefined;
  };

  fetchComments = async (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    loaderType: TCommentLoader = "fetch"
  ) => {
    this.loader = loaderType;

    let createdAfter: string | undefined;
    const _commentIds = this.getCommentsByIssueId(issueId);
    if (_commentIds && _commentIds.length > 0) {
      createdAfter = this.getCommentById(_commentIds[_commentIds.length - 1])?.created_at;
    }

    const comments = await this.issueCommentService.getIssueComments(workspaceSlug, projectId, issueId, createdAfter);

    const commentIds = comments.map((comment) => comment.id);
    runInAction(() => {
      update(this.comments, issueId, (currentIds: string[] | undefined) => {
        if (!currentIds) return commentIds;
        return uniq(concat(currentIds, commentIds));
      });
      comments.forEach((comment) => {
        this.rootIssueDetail.commentReaction.applyCommentReactions(comment.id, comment?.comment_reactions || []);
        set(this.commentMap, comment.id, comment);
      });
      this.loader = undefined;
    });

    return comments;
  };

  createComment = async (workspaceSlug: string, projectId: string, issueId: string, data: TIssueCommentWriteBody) => {
    const response = await this.issueCommentService.createIssueComment(workspaceSlug, projectId, issueId, data);

    runInAction(() => {
      update(this.comments, issueId, (currentIds: string[] | undefined) => {
        if (!currentIds) return [response.id];
        return uniq(concat(currentIds, [response.id]));
      });
      set(this.commentMap, response.id, response);
    });

    return response;
  };

  updateComment = async (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    commentId: string,
    data: TIssueCommentWriteBody
  ) => {
    try {
      runInAction(() => {
        Object.entries(data).forEach(([key, value]) => set(this.commentMap, [commentId, key], value));
      });

      const response = await this.issueCommentService.patchIssueComment(
        workspaceSlug,
        projectId,
        issueId,
        commentId,
        data
      );

      runInAction(() => {
        set(this.commentMap, [commentId, "updated_at"], response.updated_at);
        set(this.commentMap, [commentId, "edited_at"], response.edited_at);
      });

      return response;
    } catch (error) {
      this.rootIssueDetail.activity.fetchActivities(workspaceSlug, projectId, issueId);
      throw error;
    }
  };

  removeComment = async (workspaceSlug: string, projectId: string, issueId: string, commentId: string) => {
    await this.issueCommentService.deleteIssueComment(workspaceSlug, projectId, issueId, commentId);

    runInAction(() => {
      pull(this.comments[issueId], commentId);
      delete this.commentMap[commentId];
    });
  };
}
