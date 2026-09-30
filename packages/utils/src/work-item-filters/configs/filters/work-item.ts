/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type { IFilterOption, TFilterProperty } from "@plane/types";
import { COLLECTION_OPERATOR, EQUALITY_OPERATOR, FILTER_FIELD_TYPE } from "@plane/types";
// local imports
import type { IFilterIconConfig, TCreateFilterConfig, TCreateFilterConfigParams } from "../../../rich-filters";
import { createFilterConfig, createFilterFieldConfig, createOperatorConfigEntry } from "../../../rich-filters";
import { getTextInputConfig } from "../../../rich-filters/factories/configs/core";

// ------------ Title filter ------------

/**
 * Get the title filter config: the title contains a word, ignoring case.
 * @template K - The filter key
 * @param key - The filter key to use
 * @returns A function that takes parameters and returns the title filter config
 */
export const getTitleFilterConfig =
  <P extends TFilterProperty>(key: P): TCreateFilterConfig<P, TCreateFilterConfigParams & IFilterIconConfig> =>
  (params) =>
    createFilterConfig<P>({
      id: key,
      label: "Title",
      ...params,
      icon: params.filterIcon,
      allowMultipleFilters: true,
      supportedOperatorConfigsMap: new Map([
        createOperatorConfigEntry(EQUALITY_OPERATOR.ICONTAINS, params, (updatedParams) =>
          getTextInputConfig({ ...updatedParams, placeholder: "Word in the title" })
        ),
      ]),
    });

// ------------ Hierarchy filters ------------

/**
 * A work item to pick in the hierarchy filters.
 */
export type TWorkItemFilterOption = {
  id: string;
  name: string;
  /** e.g. "ISFUN-3193" */
  identifier: string;
};

/**
 * Hierarchy filter specific params. The work items load when the picker opens, so a
 * project with thousands of them does not load them up front.
 */
export type TCreateWorkItemHierarchyFilterParams = TCreateFilterConfigParams &
  IFilterIconConfig & {
    getWorkItems: () => Promise<TWorkItemFilterOption[]>;
  };

const getWorkItemMultiSelectConfig = (params: TCreateWorkItemHierarchyFilterParams) =>
  createFilterFieldConfig<typeof FILTER_FIELD_TYPE.MULTI_SELECT, string>({
    type: FILTER_FIELD_TYPE.MULTI_SELECT,
    ...params,
    singleValueOperator: EQUALITY_OPERATOR.EXACT,
    getOptions: async (): Promise<IFilterOption<string>[]> =>
      (await params.getWorkItems()).map((workItem) => ({
        id: workItem.id,
        label: `${workItem.identifier} ${workItem.name}`,
        value: workItem.id,
      })),
  });

/**
 * Get the "below" filter config: work items anywhere below the picked ones (children,
 * their children, ...), like `below` in the query language.
 * @template K - The filter key
 * @param key - The filter key to use
 * @returns A function that takes parameters and returns the below filter config
 */
export const getBelowWorkItemFilterConfig =
  <P extends TFilterProperty>(key: P): TCreateFilterConfig<P, TCreateWorkItemHierarchyFilterParams> =>
  (params) =>
    createFilterConfig<P>({
      id: key,
      label: "Below",
      ...params,
      icon: params.filterIcon,
      supportedOperatorConfigsMap: new Map([
        createOperatorConfigEntry(COLLECTION_OPERATOR.IN, params, (updatedParams) =>
          getWorkItemMultiSelectConfig(updatedParams)
        ),
      ]),
    });

/**
 * Get the parent filter config: work items directly under the picked ones.
 * @template K - The filter key
 * @param key - The filter key to use
 * @returns A function that takes parameters and returns the parent filter config
 */
export const getParentWorkItemFilterConfig =
  <P extends TFilterProperty>(key: P): TCreateFilterConfig<P, TCreateWorkItemHierarchyFilterParams> =>
  (params) =>
    createFilterConfig<P>({
      id: key,
      label: "Parent",
      ...params,
      icon: params.filterIcon,
      supportedOperatorConfigsMap: new Map([
        createOperatorConfigEntry(COLLECTION_OPERATOR.IN, params, (updatedParams) =>
          getWorkItemMultiSelectConfig(updatedParams)
        ),
      ]),
    });
