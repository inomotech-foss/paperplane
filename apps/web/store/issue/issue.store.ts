/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set } from "lodash-es";
import { action, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { TIssue, TIssueRow, TRelatedIssue } from "@plane/types";
// helpers
import { getCurrentDateTimeInISO } from "@plane/utils";
import { rootStore } from "@/lib/store-context";
// services
import { IssueService } from "@/services/issue";

export type IIssueStore = {
  // observables
  issuesMap: Record<string, TIssue>; // Record defines issue_id as key and TIssue as value
  issuesIdentifierMap: Record<string, string>; // Record defines issue_identifier as key and issue_id as value
  // actions
  getIssues(workspaceSlug: string, projectId: string, issueIds: string[]): Promise<TIssue[]>;
  addIssue(issues: TIssueRow[]): void;
  mergeIssue(issue: TIssueRow): TIssue;
  addPartialIssues(issues: TRelatedIssue[]): void;
  addIssueIdentifier(issueIdentifier: string, issueId: string): void;
  updateIssue(issueId: string, issue: Partial<TIssue>): void;
  removeIssue(issueId: string): void;
  // helper methods
  getIssueById(issueId: string): undefined | TIssue;
  getIssueIdByIdentifier(issueIdentifier: string): undefined | string;
  getIssuesByIds(issueIds: string[], type: "archived" | "un-archived"): TIssue[]; // Record defines issue_id as key and TIssue as value
};

/** A work item with every field unknown, for rows that carry only some fields. */
export const emptyIssue = (id: string): TIssue => ({
  id,
  name: "",
  sequence_id: 0,
  sort_order: 0,
  state_id: null,
  priority: null,
  label_ids: [],
  assignee_ids: [],
  estimate_point: null,
  sub_issues_count: 0,
  attachment_count: 0,
  link_count: 0,
  project_id: null,
  parent_id: null,
  cycle_id: null,
  module_ids: null,
  type_id: "",
  created_at: "",
  updated_at: "",
  start_date: null,
  target_date: null,
  completed_at: null,
  archived_at: null,
  created_by: null,
  updated_by: null,
  is_draft: false,
});

export class IssueStore implements IIssueStore {
  // observables
  issuesMap: { [issue_id: string]: TIssue } = {};
  issuesIdentifierMap: { [issue_identifier: string]: string } = {};
  // service
  issueService;

  constructor() {
    makeObservable(this, {
      // observable
      issuesMap: observable,
      issuesIdentifierMap: observable,
      // actions
      addIssue: action,
      mergeIssue: action,
      addPartialIssues: action,
      addIssueIdentifier: action,
      updateIssue: action,
      removeIssue: action,
    });
    this.issueService = new IssueService();
  }

  // actions
  /**
   * Merges rows into the issuesMap. A column the row leaves out keeps the stored value, or a default for a new work
   * item.
   */
  addIssue = (issues: TIssueRow[]) => {
    issues.forEach(this.mergeIssue);
  };

  /** Merges one row like addIssue and returns the stored work item. */
  mergeIssue = (issue: TIssueRow): TIssue => {
    const projectIdentifier = rootStore.projectRoot.project.getProjectIdentifierById(issue.project_id);
    const merged: TIssue = { ...(this.issuesMap[issue.id] ?? emptyIssue(issue.id)), ...issue };
    runInAction(() => {
      set(this.issuesIdentifierMap, `${projectIdentifier}-${issue.sequence_id}`, issue.id);
      set(this.issuesMap, issue.id, merged);
    });
    return merged;
  };

  /** Merges rows that carry some work item fields, such as relations. Unknown work items get defaults for the rest. */
  addPartialIssues = (issues: TRelatedIssue[]) => {
    runInAction(() => {
      issues.forEach((issue) => {
        if (issue.project_id && issue.sequence_id !== undefined) {
          const projectIdentifier = rootStore.projectRoot.project.getProjectIdentifierById(issue.project_id);
          set(this.issuesIdentifierMap, `${projectIdentifier}-${issue.sequence_id}`, issue.id);
        }
        const known = this.issuesMap[issue.id];
        set(this.issuesMap, issue.id, { ...(known ?? emptyIssue(issue.id)), ...issue });
      });
    });
  };

  /**
   * @description This method will add issue_identifier to the issuesIdentifierMap
   * @param issueIdentifier
   * @param issueId
   * @returns {void}
   */
  addIssueIdentifier = (issueIdentifier: string, issueId: string) => {
    if (!issueIdentifier || !issueId) return;
    runInAction(() => {
      set(this.issuesIdentifierMap, issueIdentifier, issueId);
    });
  };

  getIssues = async (workspaceSlug: string, projectId: string, issueIds: string[]) => {
    const issues = await this.issueService.retrieveIssues(workspaceSlug, projectId, issueIds);

    return issues.map((issue) => this.issuesMap[issue.id] ?? this.mergeIssue(issue));
  };

  /**
   * @description This method will update the issue in the issuesMap
   * @param {string} issueId
   * @param {Partial<TIssue>} issue
   * @returns {void}
   */
  updateIssue = (issueId: string, issue: Partial<TIssue>) => {
    if (!issue || !issueId || !this.issuesMap[issueId]) return;
    runInAction(() => {
      set(this.issuesMap, [issueId, "updated_at"], getCurrentDateTimeInISO());
      Object.entries(issue).forEach(([key, value]) => {
        set(this.issuesMap, [issueId, key], value);
      });
    });
  };

  /**
   * @description This method will remove the issue from the issuesMap
   * @param {string} issueId
   * @returns {void}
   */
  removeIssue = (issueId: string) => {
    if (!issueId || !this.issuesMap[issueId]) return;
    runInAction(() => {
      delete this.issuesMap[issueId];
    });
  };

  // helper methods
  /**
   * @description This method will return the issue from the issuesMap
   * @param {string} issueId
   * @returns {TIssue | undefined}
   */
  getIssueById = computedFn((issueId: string) => {
    if (!issueId || !this.issuesMap[issueId]) return undefined;
    return this.issuesMap[issueId];
  });

  /**
   * @description This method will return the issue_id from the issuesIdentifierMap
   * @param {string} issueIdentifier
   * @returns {string | undefined}
   */
  getIssueIdByIdentifier = computedFn((issueIdentifier: string) => {
    if (!issueIdentifier || !this.issuesIdentifierMap[issueIdentifier]) return undefined;
    return this.issuesIdentifierMap[issueIdentifier];
  });

  /**
   * @description This method will return the issues from the issuesMap
   * @param {string[]} issueIds
   * @param {boolean} archivedIssues
   * @returns {Record<string, TIssue> | undefined}
   */
  getIssuesByIds = computedFn((issueIds: string[], type: "archived" | "un-archived") => {
    if (!issueIds || issueIds.length <= 0) return [];
    const filteredIssues: TIssue[] = [];
    Object.values(issueIds).forEach((issueId) => {
      // if type is archived then check archived_at is not null
      // if type is un-archived then check archived_at is null
      const issue = this.issuesMap[issueId];
      if (issue && ((type === "archived" && issue.archived_at) || (type === "un-archived" && !issue?.archived_at))) {
        filteredIssues.push(issue);
      }
    });
    return filteredIssues;
  });
}
