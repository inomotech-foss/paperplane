/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IIssueDisplayFilterOptions, TModuleDisplayFilters } from "@plane/types";
import { EIssueLayoutTypes } from "@plane/types";

/** The timeline is always in manual order; other layouts keep the stored order. */
const getEffectiveOrderBy = <T extends string>(storedOrderBy: T | undefined, isTimeline: boolean) =>
  isTimeline ? "sort_order" : storedOrderBy;

export const getWorkItemOrderBy = (displayFilters: IIssueDisplayFilterOptions | undefined) =>
  getEffectiveOrderBy(displayFilters?.order_by, displayFilters?.layout === EIssueLayoutTypes.GANTT);

export const getModuleOrderBy = (displayFilters: TModuleDisplayFilters | undefined) =>
  getEffectiveOrderBy(displayFilters?.order_by, displayFilters?.layout === "gantt");
