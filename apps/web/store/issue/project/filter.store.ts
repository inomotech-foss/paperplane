/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { isEmpty, isEqual, set } from "lodash-es";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
// base class
import { computedFn } from "mobx-utils";
import type { TSupportedFilterTypeForUpdate } from "@plane/constants";
import { EIssueFilterType } from "@plane/constants";
import type {
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  TIssueKanbanFilters,
  IIssueFilters,
  IProjectUserPropertiesResponse,
  TIssueParams,
  IssuePaginationOptions,
  TWorkItemFilterExpression,
  TSupportedFilterForUpdate,
} from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
import { handleIssueQueryParamsByLayout, normalizeDisplayFilters } from "@plane/utils";
import { applyViewState } from "@/lib/work-item-view-url/apply";
import { toViewState } from "@/lib/work-item-view-url/state";
import { applyViewIntent, isPersonalIntent, mergeDisplayFilters } from "@/lib/work-item-view-url/intent";
import type { TViewIntent } from "@/lib/work-item-view-url/intent";
import { getWorkItemPage } from "@/lib/work-item-view-url/pages";
import { getViewRoute } from "@/lib/work-item-view-url/registry";
import type { IBaseIssueFilterStore } from "../helpers/issue-filter-helper.store";
import { IssueFilterHelperStore } from "../helpers/issue-filter-helper.store";
// helpers
// types
import type { IIssueRootStore } from "../root.store";
import type { IProjectMemberStore } from "@/store/member/project/base-project-member.store";
import type { IProjectIssues } from "./issue.store";
import { ProjectService } from "@/services/project";
// constants
// services

export interface IProjectIssuesFilter extends IBaseIssueFilterStore {
  //helper actions
  getFilterParams: (
    options: IssuePaginationOptions,
    projectId: string,
    cursor: string | undefined,
    groupId: string | undefined,
    subGroupId: string | undefined
  ) => Partial<Record<TIssueParams, string | boolean>>;
  getIssueFilters(projectId: string): IIssueFilters | undefined;
  getShouldClearIssues: (displayFilters: IIssueDisplayFilterOptions) => boolean;
  getShouldReFetchIssues: (displayFilters: IIssueDisplayFilterOptions) => boolean;
  /** Saved preferences per project. The shown filters may come from a link instead. */
  savedFilters: Record<string, IIssueFilters>;
  // action
  /** Fetches the saved preferences into savedFilters; does not change the shown filters. */
  fetchSavedFilters: (workspaceSlug: string, projectId: string) => Promise<IIssueFilters>;
  /** The saved preferences, fetched unless this store has them. */
  loadSavedFilters: (workspaceSlug: string, projectId: string) => Promise<IIssueFilters>;
  updateFilterExpression: (
    workspaceSlug: string,
    projectId: string,
    filters: TWorkItemFilterExpression
  ) => Promise<void>;
  updateFilters: (
    workspaceSlug: string,
    projectId: string,
    filterType: TSupportedFilterTypeForUpdate,
    filters: TSupportedFilterForUpdate
  ) => Promise<void>;
}

/** The parts of the issue root store the filters use. */
export type TProjectIssuesFilterRoot = Pick<IIssueRootStore, "projectId" | "currentUserId" | "workspaceSlug"> & {
  projectIssues: Pick<IProjectIssues, "clear" | "fetchIssuesWithExistingPagination">;
  rootStore: {
    memberRoot: { project: Pick<IProjectMemberStore, "fetchProjectUserProperties"> };
    user: { data?: { id: string } };
  };
};

const PROJECT_PAGE = getWorkItemPage(EIssuesStoreType.PROJECT);

export class ProjectIssuesFilter extends IssueFilterHelperStore implements IProjectIssuesFilter {
  // observables
  filters: { [projectId: string]: IIssueFilters } = {};
  savedFilters: Record<string, IIssueFilters> = {};
  // root store
  rootIssueStore: TProjectIssuesFilterRoot;
  // services
  projectService;

  constructor(_rootStore: TProjectIssuesFilterRoot) {
    super();
    makeObservable(this, {
      // observables
      filters: observable,
      // computed
      issueFilters: computed,
      appliedFilters: computed,
      // actions
      updateFilterExpression: action,
      updateFilters: action,
    });
    // root store
    this.rootIssueStore = _rootStore;
    // services
    this.projectService = new ProjectService();
  }

  get issueFilters() {
    const projectId = this.rootIssueStore.projectId;
    if (!projectId) return undefined;

    return this.getIssueFilters(projectId);
  }

  get appliedFilters() {
    const projectId = this.rootIssueStore.projectId;
    if (!projectId) return undefined;

    return this.getAppliedFilters(projectId);
  }

  getIssueFilters(projectId: string) {
    const filters = this.filters[projectId];
    if (!filters || isEmpty(filters)) return undefined;

    return this.computedIssueFilters({
      ...filters,
      kanbanFilters: filters.kanbanFilters ?? this.getStoredKanbanFilters(projectId),
    });
  }

  /** Collapsed groups are kept per user in local storage, so they are read once the user is known. */
  private getStoredKanbanFilters = computedFn((projectId: string): TIssueKanbanFilters | undefined => {
    const { workspaceSlug, rootStore } = this.rootIssueStore;
    const userId = rootStore.user.data?.id;
    if (!workspaceSlug || !userId) return undefined;
    const stored = this.handleIssuesLocalFilters.get(EIssuesStoreType.PROJECT, workspaceSlug, projectId, userId);
    return {
      group_by: stored?.kanban_filters?.group_by || [],
      sub_group_by: stored?.kanban_filters?.sub_group_by || [],
    };
  });

  getAppliedFilters(projectId: string) {
    const userFilters = this.getIssueFilters(projectId);
    if (!userFilters) return undefined;

    const filteredParams = handleIssueQueryParamsByLayout(userFilters?.displayFilters?.layout, "issues");
    if (!filteredParams) return undefined;

    const filteredRouteParams: Partial<Record<TIssueParams, string | boolean>> = this.computedFilteredParams(
      userFilters?.richFilters,
      userFilters?.displayFilters,
      filteredParams
    );

    return filteredRouteParams;
  }

  getFilterParams = computedFn(
    (
      options: IssuePaginationOptions,
      projectId: string,
      cursor: string | undefined,
      groupId: string | undefined,
      subGroupId: string | undefined
    ) => {
      const filterParams = this.getAppliedFilters(projectId);
      const paginationParams = this.getPaginationParams(filterParams, options, cursor, groupId, subGroupId);
      return paginationParams;
    }
  );

  private get projectMembers() {
    return this.rootIssueStore.rootStore.memberRoot.project;
  }

  fetchSavedFilters = async (workspaceSlug: string, projectId: string): Promise<IIssueFilters> =>
    this.setSavedFilters(projectId, await this.projectMembers.fetchProjectUserProperties(workspaceSlug, projectId));

  loadSavedFilters = async (workspaceSlug: string, projectId: string): Promise<IIssueFilters> => {
    const saved = this.savedFilters[projectId];
    if (saved) return saved;
    // not from the member store: other writers keep only part of the response there
    const properties = await this.projectMembers.fetchProjectUserProperties(workspaceSlug, projectId);
    // another caller may have loaded and changed them meanwhile
    return this.savedFilters[projectId] ?? this.setSavedFilters(projectId, properties);
  };

  private setSavedFilters = (projectId: string, properties: IProjectUserPropertiesResponse): IIssueFilters => {
    const saved: IIssueFilters = {
      richFilters: properties?.rich_filters ?? {},
      displayFilters: this.computedDisplayFilters(properties?.display_filters),
      displayProperties: this.computedDisplayProperties(properties?.display_properties),
      kanbanFilters: undefined,
    };
    this.savedFilters[projectId] = saved;
    return saved;
  };

  /**
   * Merges a change into the saved preferences and returns what to send. Undefined if nothing changed or
   * they cannot be loaded. The change is then shown but not saved.
   */
  private saveIntent = async (
    workspaceSlug: string,
    projectId: string,
    intent: TViewIntent
  ): Promise<Partial<IProjectUserPropertiesResponse> | undefined> => {
    let saved: IIssueFilters;
    try {
      saved = await this.loadSavedFilters(workspaceSlug, projectId);
    } catch (error) {
      console.error(error);
      return undefined;
    }
    switch (intent.type) {
      case "displayFilters": {
        const displayFilters = normalizeDisplayFilters(mergeDisplayFilters(saved.displayFilters ?? {}, intent.changes));
        if (isEqual(displayFilters, saved.displayFilters)) return undefined;
        saved.displayFilters = displayFilters;
        return { display_filters: displayFilters };
      }
      case "displayProperties": {
        const displayProperties = { ...saved.displayProperties, ...intent.changes };
        if (isEqual(displayProperties, saved.displayProperties)) return undefined;
        saved.displayProperties = displayProperties;
        return { display_properties: displayProperties };
      }
      case "richFilters":
        if (isEqual(intent.expression, saved.richFilters)) return undefined;
        saved.richFilters = intent.expression;
        return { rich_filters: intent.expression };
    }
  };

  /** Shows a change in place: for a project no route shows, or a setting the URL does not hold. */
  private showIntent = (workspaceSlug: string, projectId: string, intent: TViewIntent) => {
    const current = this.filters[projectId];
    if (!current) return;
    const { projectIssues } = this.rootIssueStore;
    applyViewState(this, projectId, applyViewIntent(toViewState(current), intent, PROJECT_PAGE), {
      clear: () => projectIssues.clear(true),
      refetch: () => {
        projectIssues
          .fetchIssuesWithExistingPagination(workspaceSlug, projectId, "mutation")
          .catch((error: unknown) => {
            console.error(error);
          });
      },
      setRichFilters: () => {},
    });
  };

  /**
   * Saves only the changed key onto the saved preferences, so a view opened from a link does not become
   * the preference. The saved preferences change first, as the route reads the fields the URL leaves out
   * from them.
   */
  private changeView = async (workspaceSlug: string, projectId: string, intent: TViewIntent) => {
    const patch = await this.saveIntent(workspaceSlug, projectId, intent);
    const route = isPersonalIntent(intent, PROJECT_PAGE) ? undefined : getViewRoute(PROJECT_PAGE, projectId);
    const shown = route ? route.onIntent(intent) : this.showIntent(workspaceSlug, projectId, intent);
    if (patch) {
      try {
        await this.projectService.updateProjectUserProperties(workspaceSlug, projectId, patch);
      } catch (error) {
        // the shown filters stay as they are; only the saved preferences are reloaded
        this.fetchSavedFilters(workspaceSlug, projectId).catch((reloadError: unknown) => console.error(reloadError));
        throw error;
      }
    }
    await shown;
  };

  /**
   * NOTE: This method is designed as a fallback function for the work item filter store.
   * Only use this method directly when initializing filter instances.
   * For regular filter updates, use this method as a fallback function for the work item filter store methods instead.
   */
  updateFilterExpression: IProjectIssuesFilter["updateFilterExpression"] = (workspaceSlug, projectId, filters) =>
    this.changeView(workspaceSlug, projectId, { type: "richFilters", expression: filters });

  updateFilters: IProjectIssuesFilter["updateFilters"] = async (workspaceSlug, projectId, type, filters) => {
    if (isEmpty(this.filters[projectId])) return;
    switch (type) {
      case EIssueFilterType.DISPLAY_FILTERS:
        return this.changeView(workspaceSlug, projectId, {
          type: "displayFilters",
          changes: filters as IIssueDisplayFilterOptions,
        });
      case EIssueFilterType.DISPLAY_PROPERTIES:
        return this.changeView(workspaceSlug, projectId, {
          type: "displayProperties",
          changes: filters as IIssueDisplayProperties,
        });
      case EIssueFilterType.KANBAN_FILTERS: {
        const kanbanFilters = {
          ...this.getIssueFilters(projectId)?.kanbanFilters,
          ...(filters as TIssueKanbanFilters),
        };
        const currentUserId = this.rootIssueStore.currentUserId;
        if (currentUserId)
          this.handleIssuesLocalFilters.set(EIssuesStoreType.PROJECT, type, workspaceSlug, projectId, currentUserId, {
            kanban_filters: kanbanFilters,
          });
        runInAction(() => {
          set(this.filters, [projectId, "kanbanFilters"], kanbanFilters);
        });
        return;
      }
      default:
        return;
    }
  };
}
