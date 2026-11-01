// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type {
  TModuleDisplayFilters,
  TModuleFilters,
  TModuleFiltersByState,
  TModuleLayoutOptions,
  TModuleOrderByOptions,
} from "@plane/types";
import { isRecord } from "@plane/types";
import { isOneOf } from "@/helpers/narrow.helper";

const LAYOUTS: readonly TModuleLayoutOptions[] = ["list", "board", "gantt"];
const ORDER_BY: readonly TModuleOrderByOptions[] = [
  "name",
  "-name",
  "progress",
  "-progress",
  "issues_length",
  "-issues_length",
  "target_date",
  "-target_date",
  "created_at",
  "-created_at",
  "sort_order",
];
const FILTER_KEYS = ["lead", "members", "start_date", "status", "target_date"] as const;

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const toDisplayFilters = (value: unknown): TModuleDisplayFilters => {
  const result: TModuleDisplayFilters = {};
  if (!isRecord(value)) return result;
  if (typeof value.favorites === "boolean") result.favorites = value.favorites;
  if (isOneOf(LAYOUTS, value.layout)) result.layout = value.layout;
  if (isOneOf(ORDER_BY, value.order_by)) result.order_by = value.order_by;
  return result;
};

const toFilters = (value: unknown): TModuleFilters => {
  const result: TModuleFilters = {};
  if (!isRecord(value)) return result;
  for (const key of FILTER_KEYS) {
    const filter = value[key];
    if (filter === null || isStringList(filter)) result[key] = filter;
  }
  return result;
};

/** The display filters per project kept in local storage. Unknown values are dropped. */
export function parseStoredModuleDisplayFilters(value: unknown): Record<string, TModuleDisplayFilters> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([projectId, filters]) => [projectId, toDisplayFilters(filters)])
  );
}

/** The filters per project and list kept in local storage. Unknown values are dropped. */
export function parseStoredModuleFilters(value: unknown): Record<string, TModuleFiltersByState> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([projectId, filters]) => [
      projectId,
      {
        default: toFilters(isRecord(filters) ? filters.default : undefined),
        archived: toFilters(isRecord(filters) ? filters.archived : undefined),
      },
    ])
  );
}
