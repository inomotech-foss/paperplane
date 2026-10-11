/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set, sortBy } from "lodash-es";
import { action, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { TIssueType } from "@plane/types";
// helpers
import { pickIssueTypeId } from "@/lib/work-item-type";
// services
import { IssueTypeService } from "@/services/issue";
import { IssueTypeMigrationService } from "@/services/issue/issue-type-migration.service";
import type { TTypeMigrationPreview, TTypeMigrationRequest } from "@/services/issue/issue-type-migration.service";
// store
import type { IIssueCustomPropertyStore } from "./issue-custom-property.store";
import type { IIssueActivityStore } from "./issue/issue-details/activity.store";
import type { IIssueStore } from "./issue/issue.store";
import type { IProjectMemberStore } from "./member/project/base-project-member.store";

/** The part of the root store the work item types depend on. */
type TIssueTypeRootStore = {
  issue: {
    issues: Pick<IIssueStore, "issuesMap" | "updateIssue">;
    issueDetail: { activity: Pick<IIssueActivityStore, "getActivitiesByIssueId" | "fetchActivities"> };
  };
  issueCustomProperty: Pick<IIssueCustomPropertyStore, "fetchBulkValues">;
  memberRoot: {
    project: Pick<
      IProjectMemberStore,
      "getProjectUserProperties" | "fetchProjectUserProperties" | "updateProjectUserProperties"
    >;
  };
};

export interface IIssueTypeStore {
  // loaders
  fetchedMap: Record<string, boolean>;
  // observables
  typeMap: Record<string, TIssueType>;
  // computed actions
  getProjectIssueTypes: (projectId: string | undefined | null) => TIssueType[] | undefined;
  getActiveProjectIssueTypes: (projectId: string | undefined | null) => TIssueType[] | undefined;
  getIssueTypeById: (issueTypeId: string | undefined | null) => TIssueType | null;
  getPreselectedIssueTypeId: (projectId: string | undefined | null) => string | undefined;
  // fetch actions
  fetchProjectIssueTypes: (workspaceSlug: string, projectId: string) => Promise<TIssueType[]>;
  // crud actions
  createIssueType: (workspaceSlug: string, projectId: string, data: Partial<TIssueType>) => Promise<TIssueType>;
  updateIssueType: (
    workspaceSlug: string,
    projectId: string,
    issueTypeId: string,
    data: Partial<TIssueType>
  ) => Promise<TIssueType>;
  deleteIssueType: (workspaceSlug: string, projectId: string, issueTypeId: string) => Promise<void>;
  migrateIssueType: (
    workspaceSlug: string,
    projectId: string,
    issueTypeId: string,
    body: TTypeMigrationRequest
  ) => Promise<TTypeMigrationPreview>;
  rememberIssueType: (workspaceSlug: string, projectId: string, issueTypeId: string) => Promise<void>;
}

export class IssueTypeStore implements IIssueTypeStore {
  // observables
  typeMap: Record<string, TIssueType> = {};
  // loaders
  fetchedMap: Record<string, boolean> = {};
  // root store
  rootStore;
  // services
  issueTypeService;
  migrationService;

  constructor(_rootStore: TIssueTypeRootStore) {
    makeObservable(this, {
      typeMap: observable,
      fetchedMap: observable,
      fetchProjectIssueTypes: action,
      createIssueType: action,
      updateIssueType: action,
      deleteIssueType: action,
      migrateIssueType: action,
    });

    this.rootStore = _rootStore;
    this.issueTypeService = new IssueTypeService();
    this.migrationService = new IssueTypeMigrationService();
  }

  /**
   * Returns all work item types of a project ordered by level then name.
   */
  getProjectIssueTypes = computedFn((projectId: string | undefined | null) => {
    if (!projectId || !this.fetchedMap[projectId]) return;
    return sortBy(
      Object.values(this.typeMap).filter((type) => type.project === projectId),
      ["level", "name"]
    );
  });

  /**
   * Returns the active work item types of a project.
   */
  getActiveProjectIssueTypes = computedFn((projectId: string | undefined | null) =>
    this.getProjectIssueTypes(projectId)?.filter((type) => type.is_active)
  );

  getIssueTypeById = computedFn(
    (issueTypeId: string | undefined | null): TIssueType | null => (issueTypeId && this.typeMap?.[issueTypeId]) || null
  );

  /**
   * Returns the type a new work item of the project starts with: the one the user last created a work item
   * with in the project, else the first active type.
   */
  getPreselectedIssueTypeId = computedFn((projectId: string | undefined | null) => {
    if (!projectId) return undefined;
    const properties = this.rootStore.memberRoot.project.getProjectUserProperties(projectId);
    return pickIssueTypeId(
      this.getActiveProjectIssueTypes(projectId),
      properties?.preferences?.work_items?.last_type_id
    );
  });

  /**
   * Fetches all work item types of a project.
   */
  fetchProjectIssueTypes = async (workspaceSlug: string, projectId: string) =>
    await this.issueTypeService.getProjectIssueTypes(workspaceSlug, projectId).then((response) => {
      runInAction(() => {
        // Drop stale types of the project before applying the fresh list
        Object.values(this.typeMap).forEach((type) => {
          if (type.project === projectId && !response.some((fetched) => fetched.id === type.id))
            delete this.typeMap[type.id];
        });
        response.forEach((type) => {
          // `IssueType` is workspace-scoped and enabled per project via a
          // join table, so the API payload carries no `project`. Annotate
          // it with the project it was fetched for so the project-scoped
          // selectors can filter by it (mirrors how project custom
          // properties are keyed by project).
          set(this.typeMap, [type.id], { ...type, project: projectId });
        });
        set(this.fetchedMap, projectId, true);
      });
      return response;
    });

  createIssueType = async (workspaceSlug: string, projectId: string, data: Partial<TIssueType>) =>
    await this.issueTypeService.createIssueType(workspaceSlug, projectId, data).then((response) => {
      runInAction(() => {
        set(this.typeMap, [response.id], { ...response, project: projectId });
      });
      return response;
    });

  updateIssueType = async (
    workspaceSlug: string,
    projectId: string,
    issueTypeId: string,
    data: Partial<TIssueType>
  ) => {
    const originalType = this.typeMap[issueTypeId];
    const originalTypesSnapshot: TIssueType[] = [];
    for (const type of Object.values(this.typeMap)) {
      if (type.project === projectId) originalTypesSnapshot.push({ ...type });
    }
    try {
      runInAction(() => {
        set(this.typeMap, [issueTypeId], { ...originalType, ...data });
      });
      const response = await this.issueTypeService.updateIssueType(workspaceSlug, projectId, issueTypeId, data);
      runInAction(() => {
        set(this.typeMap, [issueTypeId], { ...response, project: projectId });
      });
      return response;
    } catch (error) {
      runInAction(() => {
        originalTypesSnapshot.forEach((type) => {
          set(this.typeMap, [type.id], type);
        });
      });
      throw error;
    }
  };

  /**
   * Unlinks a type nothing in the project uses. Work items that use it move with `migrateIssueType`.
   */
  deleteIssueType = async (workspaceSlug: string, projectId: string, issueTypeId: string) => {
    if (!this.typeMap[issueTypeId]) return;
    await this.migrationService.remove(workspaceSlug, projectId, issueTypeId);
    runInAction(() => {
      delete this.typeMap[issueTypeId];
    });
  };

  /**
   * Moves work items of a type to another type, with their custom property values, and unlinks the type
   * when the request asks for it. The loaded work items follow.
   */
  migrateIssueType = async (
    workspaceSlug: string,
    projectId: string,
    issueTypeId: string,
    body: TTypeMigrationRequest
  ) => {
    const response = await this.migrationService.migrate(workspaceSlug, projectId, issueTypeId, body);
    if (body.dry_run) return response;
    const moved: string[] = [];
    runInAction(() => {
      if (body.remove_type === "unlink") delete this.typeMap[issueTypeId];
      const replacementTypeId = body.replacement_type_id;
      if (!replacementTypeId) return;
      const workItemIds = body.scope.work_items ? new Set(body.scope.work_items) : undefined;
      const { issues } = this.rootStore.issue;
      for (const issue of Object.values(issues.issuesMap)) {
        const inScope = workItemIds ? workItemIds.has(issue.id) : issue.project_id === projectId;
        if (!inScope || issue.type_id !== issueTypeId) continue;
        issues.updateIssue(issue.id, { type_id: replacementTypeId });
        moved.push(issue.id);
      }
    });
    // the moved work items record the change in their activity
    const { activity } = this.rootStore.issue.issueDetail;
    for (const issueId of moved.filter((id) => activity.getActivitiesByIssueId(id)))
      activity.fetchActivities(workspaceSlug, projectId, issueId).catch(() => undefined);
    // mapped or dropped property values
    await this.rootStore.issueCustomProperty.fetchBulkValues(workspaceSlug, projectId).catch(() => undefined);
    return response;
  };

  /**
   * Saves the type the user created a work item with as the one to preselect next time in the project.
   */
  rememberIssueType = async (workspaceSlug: string, projectId: string, issueTypeId: string) => {
    const memberStore = this.rootStore.memberRoot.project;
    const properties =
      memberStore.getProjectUserProperties(projectId) ??
      (await memberStore.fetchProjectUserProperties(workspaceSlug, projectId));
    if (properties.preferences?.work_items?.last_type_id === issueTypeId) return;
    await memberStore.updateProjectUserProperties(workspaceSlug, projectId, {
      preferences: { ...properties.preferences, work_items: { last_type_id: issueTypeId } },
    });
  };
}
