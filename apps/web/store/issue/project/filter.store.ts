/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { isEmpty, set } from "lodash-es";
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
import { handleIssueQueryParamsByLayout, getDisplayFilterCorrections, normalizeDisplayFilters } from "@plane/utils";
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
  /** The saved preferences, fetched only if neither this store nor the member store has them. */
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
export type TProjectIssuesFilterRoot = Pick<IIssueRootStore, "projectId" | "currentUserId"> & {
  projectIssues: Pick<IProjectIssues, "clear" | "fetchIssuesWithExistingPagination">;
  rootStore: {
    memberRoot: { project: Pick<IProjectMemberStore, "getProjectUserProperties" | "fetchProjectUserProperties"> };
  };
};

type TCalendarOptions = NonNullable<IIssueDisplayFilterOptions["calendar"]>;

/** The calendar options that differ from the shown ones; the options menu sends all of them. */
const changedCalendarOptions = (shown: TCalendarOptions | undefined, next: TCalendarOptions): TCalendarOptions => {
  const changed: TCalendarOptions = {};
  if (next.layout !== undefined && next.layout !== shown?.layout) changed.layout = next.layout;
  if (next.show_weekends !== undefined && next.show_weekends !== shown?.show_weekends) {
    changed.show_weekends = next.show_weekends;
  }
  return changed;
};

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
    const displayFilters = this.filters[projectId] || undefined;
    if (isEmpty(displayFilters)) return undefined;

    return this.computedIssueFilters(displayFilters);
  }

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
    this.setSavedFilters(
      workspaceSlug,
      projectId,
      await this.projectMembers.fetchProjectUserProperties(workspaceSlug, projectId)
    );

  loadSavedFilters = async (workspaceSlug: string, projectId: string): Promise<IIssueFilters> => {
    const saved = this.savedFilters[projectId];
    if (saved) return saved;
    const properties =
      this.projectMembers.getProjectUserProperties(projectId) ??
      (await this.projectMembers.fetchProjectUserProperties(workspaceSlug, projectId));
    // another caller may have loaded and changed them meanwhile
    return this.savedFilters[projectId] ?? this.setSavedFilters(workspaceSlug, projectId, properties);
  };

  /** Undefined if they cannot be loaded; a change is then shown but not saved. */
  private loadSavedForUpdate = async (workspaceSlug: string, projectId: string) => {
    try {
      return await this.loadSavedFilters(workspaceSlug, projectId);
    } catch (error) {
      console.error(error);
      return undefined;
    }
  };

  private setSavedFilters = (
    workspaceSlug: string,
    projectId: string,
    _filters: IProjectUserPropertiesResponse
  ): IIssueFilters => {
    // fetching the kanban toggle helpers in the local storage
    const kanbanFilters: TIssueKanbanFilters = {
      group_by: [],
      sub_group_by: [],
    };
    const currentUserId = this.rootIssueStore.currentUserId;
    if (currentUserId) {
      const _kanbanFilters = this.handleIssuesLocalFilters.get(
        EIssuesStoreType.PROJECT,
        workspaceSlug,
        projectId,
        currentUserId
      );
      kanbanFilters.group_by = _kanbanFilters?.kanban_filters?.group_by || [];
      kanbanFilters.sub_group_by = _kanbanFilters?.kanban_filters?.sub_group_by || [];
    }

    const saved: IIssueFilters = {
      richFilters: _filters?.rich_filters ?? {},
      displayFilters: this.computedDisplayFilters(_filters?.display_filters),
      displayProperties: this.computedDisplayProperties(_filters?.display_properties),
      kanbanFilters,
    };
    this.savedFilters[projectId] = saved;
    return saved;
  };

  /**
   * NOTE: This method is designed as a fallback function for the work item filter store.
   * Only use this method directly when initializing filter instances.
   * For regular filter updates, use this method as a fallback function for the work item filter store methods instead.
   */
  updateFilterExpression: IProjectIssuesFilter["updateFilterExpression"] = async (
    workspaceSlug,
    projectId,
    filters
  ) => {
    try {
      runInAction(() => {
        set(this.filters, [projectId, "richFilters"], filters);
      });

      this.rootIssueStore.projectIssues.fetchIssuesWithExistingPagination(workspaceSlug, projectId, "mutation");
      const saved = this.savedFilters[projectId];
      if (saved) saved.richFilters = filters;
      // only rich_filters is sent, so this needs no snapshot of the other keys
      await this.projectService.updateProjectUserProperties(workspaceSlug, projectId, {
        rich_filters: filters,
      });
    } catch (error) {
      console.log("error while updating rich filters", error);
      throw error;
    }
  };

  updateFilters: IProjectIssuesFilter["updateFilters"] = async (workspaceSlug, projectId, type, filters) => {
    try {
      if (isEmpty(this.filters) || isEmpty(this.filters[projectId])) return;

      const _filters = {
        richFilters: this.filters[projectId].richFilters,
        displayFilters: this.filters[projectId].displayFilters as IIssueDisplayFilterOptions,
        displayProperties: this.filters[projectId].displayProperties as IIssueDisplayProperties,
        kanbanFilters: this.filters[projectId].kanbanFilters as TIssueKanbanFilters,
      };

      switch (type) {
        case EIssueFilterType.DISPLAY_FILTERS: {
          const changes = filters as IIssueDisplayFilterOptions;
          const shownCalendar = _filters.displayFilters.calendar;
          const changedCalendar = changes.calendar && changedCalendarOptions(shownCalendar, changes.calendar);
          const updatedDisplayFilters: IIssueDisplayFilterOptions = {
            ...changes,
            ...(changes.calendar && { calendar: { ...shownCalendar, ...changes.calendar } }),
          };
          _filters.displayFilters = { ..._filters.displayFilters, ...updatedDisplayFilters };

          const corrections = getDisplayFilterCorrections(_filters.displayFilters);
          Object.assign(_filters.displayFilters, corrections);
          Object.assign(updatedDisplayFilters, corrections);

          runInAction(() => {
            Object.keys(updatedDisplayFilters).forEach((_key) => {
              set(
                this.filters,
                [projectId, "displayFilters", _key],
                updatedDisplayFilters[_key as keyof IIssueDisplayFilterOptions]
              );
            });
          });

          if (this.getShouldClearIssues(updatedDisplayFilters)) {
            this.rootIssueStore.projectIssues.clear(true); // clear issues for local store when some filters like layout changes
          }

          if (this.getShouldReFetchIssues(updatedDisplayFilters)) {
            this.rootIssueStore.projectIssues.fetchIssuesWithExistingPagination(workspaceSlug, projectId, "mutation");
          }

          // only the changed keys are saved, so a view opened from a link does not become the preference
          const saved = await this.loadSavedForUpdate(workspaceSlug, projectId);
          if (!saved) break;
          const savedDisplayFilters = normalizeDisplayFilters({
            ...saved.displayFilters,
            ...changes,
            ...(changedCalendar && { calendar: { ...saved.displayFilters?.calendar, ...changedCalendar } }),
          });
          saved.displayFilters = savedDisplayFilters;
          await this.projectService.updateProjectUserProperties(workspaceSlug, projectId, {
            display_filters: savedDisplayFilters,
          });

          break;
        }
        case EIssueFilterType.DISPLAY_PROPERTIES: {
          const updatedDisplayProperties = filters as IIssueDisplayProperties;

          runInAction(() => {
            Object.keys(updatedDisplayProperties).forEach((_key) => {
              set(
                this.filters,
                [projectId, "displayProperties", _key],
                updatedDisplayProperties[_key as keyof IIssueDisplayProperties]
              );
            });
          });

          const saved = await this.loadSavedForUpdate(workspaceSlug, projectId);
          if (!saved) break;
          const savedDisplayProperties = { ...saved.displayProperties, ...updatedDisplayProperties };
          saved.displayProperties = savedDisplayProperties;
          await this.projectService.updateProjectUserProperties(workspaceSlug, projectId, {
            display_properties: savedDisplayProperties,
          });
          break;
        }

        case EIssueFilterType.KANBAN_FILTERS: {
          const updatedKanbanFilters = filters as TIssueKanbanFilters;
          _filters.kanbanFilters = { ..._filters.kanbanFilters, ...updatedKanbanFilters };

          const currentUserId = this.rootIssueStore.currentUserId;
          if (currentUserId)
            this.handleIssuesLocalFilters.set(EIssuesStoreType.PROJECT, type, workspaceSlug, projectId, currentUserId, {
              kanban_filters: _filters.kanbanFilters,
            });

          runInAction(() => {
            Object.keys(updatedKanbanFilters).forEach((_key) => {
              set(
                this.filters,
                [projectId, "kanbanFilters", _key],
                updatedKanbanFilters[_key as keyof TIssueKanbanFilters]
              );
            });
          });

          break;
        }
        default:
          break;
      }
    } catch (error) {
      // the shown filters stay as the URL has them; only the saved preferences are reloaded
      this.fetchSavedFilters(workspaceSlug, projectId).catch((reloadError: unknown) => console.error(reloadError));
      throw error;
    }
  };
}
