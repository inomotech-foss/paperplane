/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { makeObservable, observable } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { TIssue, TIssueLink } from "@plane/types";
// services
import { IssueArchiveService, WorkspaceDraftService, IssueService } from "@/services/issue";
// types
import type { IIssueDetail } from "./root.store";

export interface IIssueStoreActions {
  // actions
  fetchIssue: (workspaceSlug: string, projectId: string, issueId: string) => Promise<TIssue>;
  updateIssue: (workspaceSlug: string, projectId: string, issueId: string, data: Partial<TIssue>) => Promise<void>;
  removeIssue: (workspaceSlug: string, projectId: string, issueId: string) => Promise<void>;
  archiveIssue: (workspaceSlug: string, projectId: string, issueId: string) => Promise<void>;
  addCycleToIssue: (workspaceSlug: string, projectId: string, cycleId: string, issueId: string) => Promise<void>;
  addIssueToCycle: (workspaceSlug: string, projectId: string, cycleId: string, issueIds: string[]) => Promise<void>;
  removeIssueFromCycle: (workspaceSlug: string, projectId: string, cycleId: string, issueId: string) => Promise<void>;
  changeModulesInIssue: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    addModuleIds: string[],
    removeModuleIds: string[]
  ) => Promise<void>;
  removeIssueFromModule: (workspaceSlug: string, projectId: string, moduleId: string, issueId: string) => Promise<void>;
  fetchIssueWithIdentifier: (workspaceSlug: string, project_identifier: string, sequence_id: string) => Promise<TIssue>;
}

export interface IIssueStore extends IIssueStoreActions {
  getIsFetchingIssueDetails: (issueId: string | undefined) => boolean;
  // helper methods
  getIssueById: (issueId: string) => TIssue | undefined;
  getIssueIdByIdentifier: (issueIdentifier: string) => string | undefined;
}

export class IssueStore implements IIssueStore {
  fetchingIssueDetails: string | undefined = undefined;
  // root store
  rootIssueDetailStore: IIssueDetail;
  // services
  issueService;
  issueArchiveService;
  draftWorkItemService;

  constructor(rootStore: IIssueDetail) {
    makeObservable(this, {
      fetchingIssueDetails: observable.ref,
    });
    // root store
    this.rootIssueDetailStore = rootStore;
    // services
    this.issueService = new IssueService();
    this.issueArchiveService = new IssueArchiveService();
    this.draftWorkItemService = new WorkspaceDraftService();
  }

  getIsFetchingIssueDetails = computedFn((issueId: string | undefined) => {
    if (!issueId) return false;

    return this.fetchingIssueDetails === issueId;
  });

  // helper methods
  getIssueById = computedFn((issueId: string) => {
    if (!issueId) return undefined;
    return this.rootIssueDetailStore.rootIssueStore.issues.getIssueById(issueId) ?? undefined;
  });

  getIssueIdByIdentifier = computedFn((issueIdentifier: string) => {
    if (!issueIdentifier) return undefined;
    return this.rootIssueDetailStore.rootIssueStore.issues.getIssueIdByIdentifier(issueIdentifier) ?? undefined;
  });

  // actions
  fetchIssue = async (workspaceSlug: string, projectId: string, issueId: string) => {
    this.fetchingIssueDetails = issueId;
    const { issue, links } = await this.issueService.retrieveWithLinks(workspaceSlug, projectId, issueId);
    this.addIssueToStore(issue);
    this.loadIssueRelatedData(workspaceSlug, projectId, issue, links);
    return issue;
  };

  /** Stores what the detail response embeds and fetches what it does not. */
  private loadIssueRelatedData = (workspaceSlug: string, projectId: string, issue: TIssue, links: TIssueLink[]) => {
    const detail = this.rootIssueDetailStore;
    const parent = issue.parent;
    if (parent?.id && parent.project_id) {
      void this.issueService
        .retrieve(workspaceSlug, parent.project_id, parent.id)
        .then((res) => detail.rootIssueStore.issues.addIssue([res]));
    }
    detail.addLinks(issue.id, links);
    detail.addSubscription(issue.id, issue.is_subscribed);
    void detail.fetchReactions(workspaceSlug, projectId, issue.id);
    void detail.fetchAttachments(workspaceSlug, projectId, issue.id);
    void detail.activity.fetchActivities(workspaceSlug, projectId, issue.id);
    void detail.comment.fetchComments(workspaceSlug, projectId, issue.id);
    void detail.subIssues.fetchSubIssues(workspaceSlug, projectId, issue.id);
    void detail.relation.fetchRelations(workspaceSlug, projectId, issue.id);
    void detail.rootIssueStore.rootStore.state.fetchProjectStates(workspaceSlug, projectId);
  };

  addIssueToStore = (issue: TIssue) => {
    const issuePayload: TIssue = {
      id: issue?.id,
      sequence_id: issue?.sequence_id,
      name: issue?.name,
      description_html: issue?.description_html,
      sort_order: issue?.sort_order,
      state_id: issue?.state_id,
      priority: issue?.priority,
      label_ids: issue?.label_ids,
      assignee_ids: issue?.assignee_ids,
      estimate_point: issue?.estimate_point,
      sub_issues_count: issue?.sub_issues_count,
      attachment_count: issue?.attachment_count,
      link_count: issue?.link_count,
      project_id: issue?.project_id,
      parent_id: issue?.parent_id,
      cycle_id: issue?.cycle_id,
      module_ids: issue?.module_ids,
      type_id: issue?.type_id,
      created_at: issue?.created_at,
      updated_at: issue?.updated_at,
      start_date: issue?.start_date,
      target_date: issue?.target_date,
      completed_at: issue?.completed_at,
      archived_at: issue?.archived_at,
      created_by: issue?.created_by,
      updated_by: issue?.updated_by,
      is_draft: issue?.is_draft,
      is_subscribed: issue?.is_subscribed,
    };

    this.rootIssueDetailStore.rootIssueStore.issues.addIssue([issuePayload]);
    this.fetchingIssueDetails = undefined;

    return issuePayload;
  };

  updateIssue = async (workspaceSlug: string, projectId: string, issueId: string, data: Partial<TIssue>) => {
    const currentStore = this.rootIssueDetailStore.rootIssueStore.projectIssues;

    await Promise.all([
      currentStore.updateIssue(workspaceSlug, projectId, issueId, data),
      this.rootIssueDetailStore.activity.fetchActivities(workspaceSlug, projectId, issueId),
    ]);
  };

  removeIssue = async (workspaceSlug: string, projectId: string, issueId: string) => {
    const currentStore = this.rootIssueDetailStore.rootIssueStore.projectIssues;
    currentStore.removeIssue(workspaceSlug, projectId, issueId);
  };

  archiveIssue = async (workspaceSlug: string, projectId: string, issueId: string) => {
    const currentStore = this.rootIssueDetailStore.rootIssueStore.projectIssues;
    currentStore.archiveIssue(workspaceSlug, projectId, issueId);
  };

  addCycleToIssue = async (workspaceSlug: string, projectId: string, cycleId: string, issueId: string) => {
    await this.rootIssueDetailStore.rootIssueStore.cycleIssues.addCycleToIssue(
      workspaceSlug,
      projectId,
      cycleId,
      issueId
    );
    await this.rootIssueDetailStore.activity.fetchActivities(workspaceSlug, projectId, issueId);
  };

  addIssueToCycle = async (workspaceSlug: string, projectId: string, cycleId: string, issueIds: string[]) => {
    await this.rootIssueDetailStore.rootIssueStore.cycleIssues.addIssueToCycle(
      workspaceSlug,
      projectId,
      cycleId,
      issueIds,
      false
    );
    if (issueIds && issueIds.length > 0)
      await this.rootIssueDetailStore.activity.fetchActivities(workspaceSlug, projectId, issueIds[0]);
  };

  removeIssueFromCycle = async (workspaceSlug: string, projectId: string, cycleId: string, issueId: string) => {
    const cycle = await this.rootIssueDetailStore.rootIssueStore.cycleIssues.removeIssueFromCycle(
      workspaceSlug,
      projectId,
      cycleId,
      issueId
    );
    await this.rootIssueDetailStore.activity.fetchActivities(workspaceSlug, projectId, issueId);
    return cycle;
  };

  changeModulesInIssue = async (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    addModuleIds: string[],
    removeModuleIds: string[]
  ) => {
    await this.rootIssueDetailStore.rootIssueStore.moduleIssues.changeModulesInIssue(
      workspaceSlug,
      projectId,
      issueId,
      addModuleIds,
      removeModuleIds
    );
    await this.rootIssueDetailStore.activity.fetchActivities(workspaceSlug, projectId, issueId);
  };

  removeIssueFromModule = async (workspaceSlug: string, projectId: string, moduleId: string, issueId: string) => {
    const currentModule = await this.rootIssueDetailStore.rootIssueStore.moduleIssues.removeIssuesFromModule(
      workspaceSlug,
      projectId,
      moduleId,
      [issueId]
    );
    await this.rootIssueDetailStore.activity.fetchActivities(workspaceSlug, projectId, issueId);
    return currentModule;
  };

  fetchIssueWithIdentifier = async (workspaceSlug: string, project_identifier: string, sequence_id: string) => {
    const { issue, links } = await this.issueService.retrieveWithIdentifier(
      workspaceSlug,
      project_identifier,
      sequence_id
    );
    const projectId = issue.project_id;
    if (!projectId) throw new Error("Issue not found");

    this.addIssueToStore(issue);
    this.rootIssueDetailStore.rootIssueStore.issues.addIssueIdentifier(
      `${project_identifier}-${sequence_id}`,
      issue.id
    );
    this.loadIssueRelatedData(workspaceSlug, projectId, issue, links);
    return issue;
  };
}
