/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { EIssueGroupByToServerOptions, EServerGroupByToFilterOptions } from "@plane/constants";
import type { IssuePaginationOptions, TIssueParams } from "@plane/types";

/**
 * This Method is used to construct the url params along with paginated values
 * @param filterParams params generated from filters
 * @param options pagination options
 * @param cursor cursor if exists
 * @param groupId groupId if to fetch By group
 * @param subGroupId groupId if to fetch By sub group
 * @returns
 */
export const getPaginationParams = (
  filterParams: Partial<Record<TIssueParams, string | boolean>> | undefined,
  options: IssuePaginationOptions,
  cursor: string | undefined,
  groupId?: string,
  subGroupId?: string
) => {
  // if cursor exists, use the cursor. If it doesn't exist construct the cursor based on per page count
  const pageCursor = cursor ? cursor : groupId ? `${options.perPageCount}:1:0` : `${options.perPageCount}:0:0`;

  // pagination params
  const paginationParams: Partial<Record<TIssueParams, string | boolean>> = {
    ...filterParams,
    cursor: pageCursor,
    per_page: options.perPageCount.toString(),
  };

  const groupBy = options.groupedBy ? EIssueGroupByToServerOptions[options.groupedBy] : undefined;
  const subGroupBy = options.subGroupedBy ? EIssueGroupByToServerOptions[options.subGroupedBy] : undefined;

  // If group by is specifically sent through options, like that for calendar layout, use that to group
  if (groupBy) paginationParams.group_by = groupBy;
  if (subGroupBy) paginationParams.sub_group_by = subGroupBy;

  // If group by is specifically sent through options, like that for calendar layout, use that to group
  if (options.orderBy) {
    paginationParams.order_by = options.orderBy;
  }

  // If before and after dates are sent from option to filter by then, add them to filter the options
  if (options.after && options.before) {
    paginationParams["target_date"] = `${options.after};after,${options.before};before`;
  }

  // If groupId is passed down, add a filter param for that group Id
  if (groupId) {
    delete paginationParams["group_by"];
    if (groupBy) paginationParams[EServerGroupByToFilterOptions[groupBy]] = groupId;
  }

  // If subGroupId is passed down, add a filter param for that subGroup Id
  if (subGroupId) {
    delete paginationParams["sub_group_by"];
    if (subGroupBy) paginationParams[EServerGroupByToFilterOptions[subGroupBy]] = subGroupId;
  }

  return paginationParams;
};
