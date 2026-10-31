/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type {
  TFilters,
  TIssueFilterKeys,
  TIssueLayout,
  TIssueQueryFilters,
  TIssueQueryFiltersParams,
} from "@/types/issue";
import { isIssuePriority } from "./narrow.helper";

export const ISSUE_FILTER_KEYS: TIssueFilterKeys[] = ["priority", "state", "labels"];

export const ISSUE_LAYOUTS: TIssueLayout[] = ["list", "kanban", "calendar", "gantt", "spreadsheet"];

/** Adds the value when it is missing, removes it otherwise. */
export const toggleFilterValue = (values: readonly string[], value: string): string[] =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

/** Splits a comma separated query param. A missing param gives an empty list. */
export const splitQueryParam = (value: string | undefined): string[] =>
  value ? value.split(",").filter((item) => item !== "") : [];

/** Builds the filters from the query params, dropping unknown priorities. */
export const filtersFromQuery = (query: { priority?: string; state?: string; labels?: string }): TFilters => ({
  priority: splitQueryParam(query.priority).filter(isIssuePriority),
  state: splitQueryParam(query.state),
  labels: splitQueryParam(query.labels),
});

export const hasAppliedFilters = (filters: Partial<TFilters> | undefined): boolean =>
  ISSUE_FILTER_KEYS.some((key) => (filters?.[key]?.length ?? 0) > 0);

/** Joins the enabled filters into query params. An empty param still makes the API run that filter, so it is left out. */
export const toFilterQueryParams = (
  filters: TIssueQueryFilters,
  enabledKeys: readonly TIssueFilterKeys[]
): TIssueQueryFiltersParams => {
  const params: TIssueQueryFiltersParams = {};
  for (const key of enabledKeys) {
    const values = filters[key];
    if (values && values.length > 0) params[key] = values.join(",");
  }
  return params;
};
