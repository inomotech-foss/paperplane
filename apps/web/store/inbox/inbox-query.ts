// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { EPastDurationFilters } from "@plane/constants";
import type { TInboxIssueFilter, TInboxIssueSorting, TInboxIssueSortingOrderByQueryParamKeys } from "@plane/types";
import { getCustomDates } from "@plane/utils";
import { findLiteral } from "@/helpers/narrow.helper";
import type { TInboxIssueListQuery } from "@/services/inbox/inbox-issue.service";

export const INBOX_FILTER_KEYS: (keyof TInboxIssueFilter)[] = [
  "assignees",
  "created_by",
  "created_at",
  "updated_at",
  "state",
  "status",
  "priority",
  "labels",
];

const PAST_DURATIONS = Object.values(EPastDurationFilters);

/** A past duration such as last_7_days becomes a date range. A custom range such as 2026-01-01;after is kept. */
const toDateQuery = (value: string): string => {
  const duration = findLiteral(PAST_DURATIONS, value);
  return duration ? getCustomDates(duration) : value;
};

const toOrderBy = (sorting: Partial<TInboxIssueSorting>): TInboxIssueSortingOrderByQueryParamKeys => {
  if (!sorting.order_by || !sorting.sort_by) return "-issue__created_at";
  return sorting.sort_by === "desc" ? `-${sorting.order_by}` : sorting.order_by;
};

export const inboxIssueQuery = (
  filters: Partial<TInboxIssueFilter>,
  sorting: Partial<TInboxIssueSorting>,
  perPage: number,
  cursor: string
): TInboxIssueListQuery => {
  const query: TInboxIssueListQuery = { order_by: toOrderBy(sorting), per_page: perPage, cursor };
  for (const key of INBOX_FILTER_KEYS) {
    const values: (string | number)[] | undefined = filters[key];
    if (!values?.length) continue;
    query[key] = (key === "created_at" || key === "updated_at" ? values.map(String).map(toDateQuery) : values).join(
      ","
    );
  }
  return query;
};

export const countAppliedInboxFilters = (filters: Partial<TInboxIssueFilter>): number =>
  INBOX_FILTER_KEYS.reduce((count, key) => count + (filters[key]?.length ?? 0), 0);
