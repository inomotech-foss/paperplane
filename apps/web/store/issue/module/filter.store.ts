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
  TIssueParams,
  IssuePaginationOptions,
  TWorkItemFilterExpression,
  TSupportedFilterForUpdate,
} from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
import { handleIssueQueryParamsByLayout, getDisplayFilterCorrections } from "@plane/utils";
import { IssueFiltersService } from "@/services/issue_filter.service";
import type { IBaseIssueFilterStore } from "../helpers/issue-filter-helper.store";
import {
  IssueFilterHelperStore,
  toDisplayFilterChanges,
  toDisplayPropertyChanges,
  toKanbanFilterChanges,
} from "../helpers/issue-filter-helper.store";
// helpers
// types
import type { IIssueRootStore } from "../root.store";
// constants
// services

export interface IModuleIssuesFilter extends IBaseIssueFilterStore {
  //helper actions
  getFilterParams: (
    options: IssuePaginationOptions,
    moduleId: string,
    cursor: string | undefined,
    groupId: string | undefined,
    subGroupId: string | undefined
  ) => Partial<Record<TIssueParams, string | boolean>>;
  getIssueFilters(moduleId: string): IIssueFilters | undefined;
  // action
  fetchFilters: (workspaceSlug: string, projectId: string, moduleId: string) => Promise<void>;
  updateFilterExpression: (
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    filters: TWorkItemFilterExpression
  ) => Promise<void>;
  updateFilters: (
    workspaceSlug: string,
    projectId: string,
    filterType: TSupportedFilterTypeForUpdate,
    filters: TSupportedFilterForUpdate,
    moduleId: string
  ) => Promise<void>;
}

export class ModuleIssuesFilter extends IssueFilterHelperStore implements IModuleIssuesFilter {
  // observables
  filters: { [moduleId: string]: IIssueFilters } = {};
  // root store
  rootIssueStore: IIssueRootStore;
  // services
  issueFilterService;

  constructor(_rootStore: IIssueRootStore) {
    super();
    makeObservable(this, {
      // observables
      filters: observable,
      // computed
      issueFilters: computed,
      appliedFilters: computed,
      // actions
      fetchFilters: action,
      updateFilters: action,
    });
    // root store
    this.rootIssueStore = _rootStore;
    // services
    this.issueFilterService = new IssueFiltersService();
  }

  get issueFilters() {
    const moduleId = this.rootIssueStore.moduleId;
    if (!moduleId) return undefined;

    return this.getIssueFilters(moduleId);
  }

  get appliedFilters() {
    const moduleId = this.rootIssueStore.moduleId;
    if (!moduleId) return undefined;

    return this.getAppliedFilters(moduleId);
  }

  getIssueFilters(moduleId: string) {
    const displayFilters = this.filters[moduleId] || undefined;
    if (isEmpty(displayFilters)) return undefined;

    const _filters: IIssueFilters = this.computedIssueFilters(displayFilters);

    return _filters;
  }

  getAppliedFilters(moduleId: string) {
    const userFilters = this.getIssueFilters(moduleId);
    if (!userFilters) return undefined;

    const filteredParams = handleIssueQueryParamsByLayout(userFilters?.displayFilters?.layout, "issues");
    if (!filteredParams) return undefined;

    if (filteredParams.includes("module")) filteredParams.splice(filteredParams.indexOf("module"), 1);

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
      moduleId: string,
      cursor: string | undefined,
      groupId: string | undefined,
      subGroupId: string | undefined
    ) => {
      let filterParams = this.getAppliedFilters(moduleId);

      if (!filterParams) {
        filterParams = {};
      }
      filterParams["module"] = moduleId;

      const paginationParams = this.getPaginationParams(filterParams, options, cursor, groupId, subGroupId);
      return paginationParams;
    }
  );

  fetchFilters = async (workspaceSlug: string, projectId: string, moduleId: string) => {
    const _filters = await this.issueFilterService.fetchModuleIssueFilters(workspaceSlug, projectId, moduleId);

    const richFilters: TWorkItemFilterExpression = _filters?.rich_filters;
    const displayFilters: IIssueDisplayFilterOptions = this.computedDisplayFilters(_filters?.display_filters);
    const displayProperties: IIssueDisplayProperties = this.computedDisplayProperties(_filters?.display_properties);

    // fetching the kanban toggle helpers in the local storage
    const kanbanFilters: TIssueKanbanFilters = {
      group_by: [],
      sub_group_by: [],
    };
    const currentUserId = this.rootIssueStore.currentUserId;
    if (currentUserId) {
      const _kanbanFilters = this.handleIssuesLocalFilters.get(
        EIssuesStoreType.MODULE,
        workspaceSlug,
        moduleId,
        currentUserId
      );
      kanbanFilters.group_by = _kanbanFilters?.kanban_filters?.group_by || [];
      kanbanFilters.sub_group_by = _kanbanFilters?.kanban_filters?.sub_group_by || [];
    }

    runInAction(() => {
      set(this.filters, [moduleId, "richFilters"], richFilters);
      set(this.filters, [moduleId, "displayFilters"], displayFilters);
      set(this.filters, [moduleId, "displayProperties"], displayProperties);
      set(this.filters, [moduleId, "kanbanFilters"], kanbanFilters);
    });
  };

  /**
   * NOTE: This method is designed as a fallback function for the work item filter store.
   * Only use this method directly when initializing filter instances.
   * For regular filter updates, use this method as a fallback function for the work item filter store methods instead.
   */
  updateFilterExpression: IModuleIssuesFilter["updateFilterExpression"] = async (
    workspaceSlug,
    projectId,
    moduleId,
    filters
  ) => {
    try {
      runInAction(() => {
        set(this.filters, [moduleId, "richFilters"], filters);
      });

      this.rootIssueStore.moduleIssues.fetchIssuesWithExistingPagination(
        workspaceSlug,
        projectId,
        "mutation",
        moduleId
      );
      await this.issueFilterService.patchModuleIssueFilters(workspaceSlug, projectId, moduleId, {
        rich_filters: filters,
      });
    } catch (error) {
      console.log("error while updating rich filters", error);
      throw error;
    }
  };

  updateFilters: IModuleIssuesFilter["updateFilters"] = async (workspaceSlug, projectId, type, filters, moduleId) => {
    try {
      if (isEmpty(this.filters) || isEmpty(this.filters[moduleId])) return;

      const _filters = {
        richFilters: this.filters[moduleId].richFilters,
        displayFilters: this.filters[moduleId].displayFilters ?? {},
        displayProperties: this.filters[moduleId].displayProperties ?? {},
        kanbanFilters: this.filters[moduleId].kanbanFilters ?? { group_by: [], sub_group_by: [] },
      };

      switch (type) {
        case EIssueFilterType.DISPLAY_FILTERS: {
          const changes = toDisplayFilterChanges(filters);
          // calendar changes carry only the changed options
          const updatedDisplayFilters: IIssueDisplayFilterOptions = {
            ...changes,
            ...(changes.calendar && { calendar: { ..._filters.displayFilters?.calendar, ...changes.calendar } }),
          };
          _filters.displayFilters = { ..._filters.displayFilters, ...updatedDisplayFilters };

          const corrections = getDisplayFilterCorrections(_filters.displayFilters);
          Object.assign(_filters.displayFilters, corrections);
          Object.assign(updatedDisplayFilters, corrections);

          runInAction(() => {
            Object.entries(updatedDisplayFilters).forEach(([_key, value]) => {
              set(this.filters, [moduleId, "displayFilters", _key], value);
            });
          });

          if (this.getShouldClearIssues(updatedDisplayFilters)) {
            this.rootIssueStore.moduleIssues.clear(true); // clear issues for local store when some filters like layout changes
          }

          if (this.getShouldReFetchIssues(updatedDisplayFilters)) {
            this.rootIssueStore.moduleIssues.fetchIssuesWithExistingPagination(
              workspaceSlug,
              projectId,
              "mutation",
              moduleId
            );
          }

          await this.issueFilterService.patchModuleIssueFilters(workspaceSlug, projectId, moduleId, {
            display_filters: _filters.displayFilters,
          });

          break;
        }
        case EIssueFilterType.DISPLAY_PROPERTIES: {
          const updatedDisplayProperties = toDisplayPropertyChanges(filters);
          _filters.displayProperties = { ..._filters.displayProperties, ...updatedDisplayProperties };

          runInAction(() => {
            Object.entries(updatedDisplayProperties).forEach(([_key, value]) => {
              set(this.filters, [moduleId, "displayProperties", _key], value);
            });
          });

          await this.issueFilterService.patchModuleIssueFilters(workspaceSlug, projectId, moduleId, {
            display_properties: _filters.displayProperties,
          });
          break;
        }

        case EIssueFilterType.KANBAN_FILTERS: {
          const updatedKanbanFilters = toKanbanFilterChanges(filters);
          _filters.kanbanFilters = { ..._filters.kanbanFilters, ...updatedKanbanFilters };

          const currentUserId = this.rootIssueStore.currentUserId;
          if (currentUserId)
            this.handleIssuesLocalFilters.set(EIssuesStoreType.MODULE, type, workspaceSlug, moduleId, currentUserId, {
              kanban_filters: _filters.kanbanFilters,
            });

          runInAction(() => {
            Object.entries(updatedKanbanFilters).forEach(([_key, value]) => {
              set(this.filters, [moduleId, "kanbanFilters", _key], value);
            });
          });

          break;
        }
        default:
          break;
      }
    } catch (error) {
      if (moduleId) this.fetchFilters(workspaceSlug, projectId, moduleId);
      throw error;
    }
  };
}
