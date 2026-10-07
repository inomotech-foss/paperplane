/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { isEmpty } from "lodash-es";
// plane constants
import type { EIssueFilterType } from "@plane/constants";
import {
  EIssueGroupByToServerOptions,
  EServerGroupByToFilterOptions,
  ENABLE_ISSUE_DEPENDENCIES,
} from "@plane/constants";
import type {
  EIssuesStoreType,
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  IIssueFilterOptions,
  IIssueFilters,
  IssuePaginationOptions,
  TIssueParams,
  TStaticViewTypes,
  TWorkItemFilterExpression,
} from "@plane/types";
import { EIssueLayoutTypes } from "@plane/types";
// helpers
import { getComputedDisplayFilters, getComputedDisplayProperties } from "@plane/utils";
// lib
import { storage } from "@/lib/local-storage";
import { getWorkItemOrderBy } from "@/store/timeline-order";
import type { ILocalStoreIssueFilters, TLocalIssueFilters } from "./local-issue-filters";
import { parseLocalIssueFilters } from "./local-issue-filters";

const LOCAL_ISSUE_FILTERS_KEY = "issue_local_filters";

const isSameEntry = (
  filter: ILocalStoreIssueFilters,
  currentView: EIssuesStoreType,
  workspaceSlug: string,
  viewId: string | undefined,
  userId: string | undefined
) =>
  filter.key === currentView &&
  filter.workspaceSlug === workspaceSlug &&
  filter.viewId === viewId &&
  filter.userId === userId;

export interface IBaseIssueFilterStore {
  // observables
  filters: Record<string, IIssueFilters>;
  //computed
  appliedFilters: Partial<Record<TIssueParams, string | boolean>> | undefined;
  issueFilters: IIssueFilters | undefined;
}

export interface IIssueFilterHelperStore {
  computedIssueFilters(filters: IIssueFilters): IIssueFilters;
  computedFilteredParams(
    richFilters: TWorkItemFilterExpression,
    displayFilters: IIssueDisplayFilterOptions | undefined,
    acceptableParamsByLayout: TIssueParams[]
  ): Partial<Record<TIssueParams, string | boolean>>;
  computedFilters(filters: IIssueFilterOptions): IIssueFilterOptions;
  getFilterConditionBasedOnViews: (
    currentUserId: string | undefined,
    type: TStaticViewTypes
  ) => Partial<Record<TIssueParams, string>> | undefined;
  computedDisplayFilters(
    displayFilters: IIssueDisplayFilterOptions | undefined,
    defaultValues?: IIssueDisplayFilterOptions
  ): IIssueDisplayFilterOptions;
  computedDisplayProperties(filters: IIssueDisplayProperties | undefined): IIssueDisplayProperties;
}

export class IssueFilterHelperStore implements IIssueFilterHelperStore {
  // oxlint-disable-next-line no-useless-constructor
  constructor() {}

  /**
   * @description This method is used to apply the display filters on the issues
   * @param {IIssueFilters} filters
   * @returns {IIssueFilters}
   */
  computedIssueFilters = (filters: IIssueFilters): IIssueFilters => ({
    richFilters: isEmpty(filters?.richFilters) ? {} : filters?.richFilters,
    displayFilters: isEmpty(filters?.displayFilters) ? undefined : filters?.displayFilters,
    displayProperties: isEmpty(filters?.displayProperties) ? undefined : filters?.displayProperties,
    kanbanFilters: isEmpty(filters?.kanbanFilters) ? undefined : filters?.kanbanFilters,
  });

  /**
   * @description This method is used to convert the filters array params to string params
   * @param {TWorkItemFilterExpression} richFilters
   * @param {IIssueDisplayFilterOptions} displayFilters
   * @param {string[]} acceptableParamsByLayout
   * @returns {Partial<Record<TIssueParams, string | boolean>>}
   */
  computedFilteredParams = (
    richFilters: TWorkItemFilterExpression,
    displayFilters: IIssueDisplayFilterOptions | undefined,
    acceptableParamsByLayout: TIssueParams[]
  ): Partial<Record<TIssueParams, string | boolean>> => {
    const pql = displayFilters?.pql?.trim() || undefined;
    const computedDisplayFilters: Partial<Record<TIssueParams, undefined | string[] | boolean | string>> = {
      group_by: displayFilters?.group_by ? EIssueGroupByToServerOptions[displayFilters.group_by] : undefined,
      sub_group_by: displayFilters?.sub_group_by
        ? EIssueGroupByToServerOptions[displayFilters.sub_group_by]
        : undefined,
      order_by: getWorkItemOrderBy(displayFilters),
      // A query decides which work items match; hiding nested matches would
      // make "all invoices of a customer" return nothing.
      sub_issue: pql ? true : (displayFilters?.sub_issue ?? true),
    };

    const issueFiltersParams: Partial<Record<TIssueParams, boolean | string>> = {};
    Object.keys(computedDisplayFilters).forEach((key) => {
      const _key = key as TIssueParams;
      const _value: string | boolean | string[] | undefined = computedDisplayFilters[_key];
      const nonEmptyArrayValue = Array.isArray(_value) && _value.length === 0 ? undefined : _value;
      if (nonEmptyArrayValue != undefined && acceptableParamsByLayout.includes(_key))
        issueFiltersParams[_key] = Array.isArray(nonEmptyArrayValue)
          ? nonEmptyArrayValue.join(",")
          : nonEmptyArrayValue;
    });

    // work item filters
    if (richFilters) issueFiltersParams.filters = JSON.stringify(richFilters);

    // Plane Query Language, on every layout
    if (pql) issueFiltersParams.pql = pql;

    if (displayFilters?.layout) issueFiltersParams.layout = displayFilters?.layout;

    if (ENABLE_ISSUE_DEPENDENCIES && displayFilters?.layout === EIssueLayoutTypes.GANTT)
      issueFiltersParams["expand"] = "issue_relation,issue_related";

    return issueFiltersParams;
  };

  /**
   * @description This method is used to apply the filters on the issues
   * @param {IIssueFilterOptions} filters
   * @returns {IIssueFilterOptions}
   */
  computedFilters = (filters: IIssueFilterOptions): IIssueFilterOptions => ({
    priority: filters?.priority || null,
    state: filters?.state || null,
    state_group: filters?.state_group || null,
    assignees: filters?.assignees || null,
    mentions: filters?.mentions || null,
    created_by: filters?.created_by || null,
    labels: filters?.labels || null,
    cycle: filters?.cycle || null,
    module: filters?.module || null,
    start_date: filters?.start_date || null,
    target_date: filters?.target_date || null,
    project: filters?.project || null,
    team_project: filters?.team_project || null,
    subscriber: filters?.subscriber || null,
    issue_type: filters?.issue_type || null,
  });

  /**
   * @description This method is used to get the filter conditions based on the views
   * @param currentUserId
   * @param type
   * @returns
   */
  getFilterConditionBasedOnViews: IIssueFilterHelperStore["getFilterConditionBasedOnViews"] = (currentUserId, type) => {
    if (!currentUserId) return undefined;
    switch (type) {
      case "assigned":
        return {
          assignees: currentUserId,
        };
      case "created":
        return {
          created_by: currentUserId,
        };
      case "subscribed":
        return {
          subscriber: currentUserId,
        };
      case "all-issues":
      default:
        return undefined;
    }
  };

  /**
   * @description This method is used to apply the display filters on the issues
   * @param {IIssueDisplayFilterOptions} displayFilters
   * @returns {IIssueDisplayFilterOptions}
   */
  computedDisplayFilters = (
    displayFilters: IIssueDisplayFilterOptions | undefined,
    defaultValues?: IIssueDisplayFilterOptions
  ): IIssueDisplayFilterOptions => {
    const computedFilters = getComputedDisplayFilters(displayFilters, defaultValues);
    return computedFilters;
  };

  /**
   * @description This method is used to apply the display properties on the issues
   * @param {IIssueDisplayProperties} displayProperties
   * @returns {IIssueDisplayProperties}
   */
  computedDisplayProperties = (displayProperties: IIssueDisplayProperties | undefined): IIssueDisplayProperties =>
    getComputedDisplayProperties(displayProperties);

  handleIssuesLocalFilters = {
    fetchFiltersFromStorage: (): ILocalStoreIssueFilters[] =>
      parseLocalIssueFilters(storage.get(LOCAL_ISSUE_FILTERS_KEY)),

    get: (
      currentView: EIssuesStoreType,
      workspaceSlug: string,
      viewId: string | undefined, // It can be projectId, moduleId, cycleId, projectViewId
      userId: string | undefined
    ): TLocalIssueFilters | undefined =>
      this.handleIssuesLocalFilters
        .fetchFiltersFromStorage()
        .find((filter) => isSameEntry(filter, currentView, workspaceSlug, viewId, userId))?.filters,

    set: <T extends EIssueFilterType>(
      currentView: EIssuesStoreType,
      filterType: T,
      workspaceSlug: string,
      viewId: string | undefined, // It can be projectId, moduleId, cycleId, projectViewId
      userId: string | undefined,
      filters: Pick<TLocalIssueFilters, T>
    ) => {
      const storageFilters = this.handleIssuesLocalFilters.fetchFiltersFromStorage();
      const entry = storageFilters.find((filter) => isSameEntry(filter, currentView, workspaceSlug, viewId, userId));
      const merged: TLocalIssueFilters = { ...entry?.filters };
      merged[filterType] = filters[filterType];

      if (entry) entry.filters = merged;
      else storageFilters.push({ key: currentView, workspaceSlug, viewId, userId, filters: merged });
      // All group_by "filters" are stored in a single array, will cause inconsistency in case of duplicated values
      storage.set(LOCAL_ISSUE_FILTERS_KEY, JSON.stringify(storageFilters));
    },
  };

  /**
   * This Method returns true if the display properties changed requires a server side update
   * @param displayFilters
   * @returns
   */
  getShouldReFetchIssues = (displayFilters: IIssueDisplayFilterOptions) => {
    const NON_SERVER_DISPLAY_FILTERS = ["order_by", "sub_issue", "type", "pql"];
    const displayFilterKeys = Object.keys(displayFilters);

    return NON_SERVER_DISPLAY_FILTERS.some((serverDisplayfilter: string) =>
      displayFilterKeys.includes(serverDisplayfilter)
    );
  };

  /**
   * This Method returns true if the display properties changed requires a server side update
   * @param displayFilters
   * @returns
   */
  getShouldClearIssues = (displayFilters: IIssueDisplayFilterOptions) => {
    const NON_SERVER_DISPLAY_FILTERS = ["layout"];
    const displayFilterKeys = Object.keys(displayFilters);

    return NON_SERVER_DISPLAY_FILTERS.some((serverDisplayfilter: string) =>
      displayFilterKeys.includes(serverDisplayfilter)
    );
  };

  /**
   * This Method is used to construct the url params along with paginated values
   * @param filterParams params generated from filters
   * @param options pagination options
   * @param cursor cursor if exists
   * @param groupId groupId if to fetch By group
   * @param subGroupId groupId if to fetch By sub group
   * @returns
   */
  getPaginationParams(
    filterParams: Partial<Record<TIssueParams, string | boolean>> | undefined,
    options: IssuePaginationOptions,
    cursor: string | undefined,
    groupId?: string,
    subGroupId?: string
  ) {
    // if cursor exists, use the cursor. If it doesn't exist construct the cursor based on per page count
    const pageCursor = cursor ? cursor : groupId ? `${options.perPageCount}:1:0` : `${options.perPageCount}:0:0`;

    // pagination params
    const paginationParams: Partial<Record<TIssueParams, string | boolean>> = {
      ...filterParams,
      cursor: pageCursor,
      per_page: options.perPageCount.toString(),
    };

    // If group by is specifically sent through options, like that for calendar layout, use that to group
    if (options.groupedBy) {
      paginationParams.group_by = options.groupedBy;
    }

    // If before and after dates are sent from option to filter by then, add them to filter the options
    if (options.after && options.before) {
      paginationParams["target_date"] = `${options.after};after,${options.before};before`;
    }

    // If groupId is passed down, add a filter param for that group Id
    if (groupId) {
      const groupBy = paginationParams["group_by"] as EIssueGroupByToServerOptions | undefined;
      delete paginationParams["group_by"];

      if (groupBy) {
        const groupByFilterOption = EServerGroupByToFilterOptions[groupBy];
        paginationParams[groupByFilterOption] = groupId;
      }
    }

    // If subGroupId is passed down, add a filter param for that subGroup Id
    if (subGroupId) {
      const subGroupBy = paginationParams["sub_group_by"] as EIssueGroupByToServerOptions | undefined;
      delete paginationParams["sub_group_by"];

      if (subGroupBy) {
        const subGroupByFilterOption = EServerGroupByToFilterOptions[subGroupBy];
        paginationParams[subGroupByFilterOption] = subGroupId;
      }
    }

    return paginationParams;
  }
}
