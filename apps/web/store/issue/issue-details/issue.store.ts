/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { makeObservable, observable } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { TIssue, TIssueLink, TIssueRow } from "@plane/types";
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

  /** Stores the work item without its embedded parent and returns what the store holds. */
  addIssueToStore = (issue: TIssueRow) => {
    const { parent: _parent, ...row } = issue;
    const stored = this.rootIssueDetailStore.rootIssueStore.issues.mergeIssue(row);
    this.fetchingIssueDetails = undefined;
    return stored;
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

    const stored = this.addIssueToStore(issue);
    this.rootIssueDetailStore.rootIssueStore.issues.addIssueIdentifier(
      `${project_identifier}-${sequence_id}`,
      issue.id
    );
    this.loadIssueRelatedData(workspaceSlug, projectId, issue, links);
    return stored;
  };
}
