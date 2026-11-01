/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { isOneOf, isRecord } from "@plane/types";
import type { TCycleGroups, TIssueRelationTypes } from "@plane/types";

export const hasStringId = (value: unknown): value is { id: string } => isRecord(value) && typeof value.id === "string";

export const keysOf = <T extends object>(obj: T): (keyof T & string)[] =>
  Object.keys(obj).filter((key): key is keyof T & string => key in obj);

const CYCLE_GROUPS: readonly TCycleGroups[] = ["current", "upcoming", "completed", "draft"];

/** Lowercases a cycle status into a cycle group. Unknown values fall back to "draft". */
export const toCycleGroup = (status: string | null | undefined): TCycleGroups => {
  const group = status?.toLocaleLowerCase();
  return CYCLE_GROUPS.find((item) => item === group) ?? "draft";
};

/** Reads a nested string property of an unknown value, such as `data.error` of an API error. */
export const getStringProp = (value: unknown, ...path: string[]): string | undefined => {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return typeof current === "string" ? current : undefined;
};

const RELATION_TYPES: readonly TIssueRelationTypes[] = ["blocking", "blocked_by", "duplicate", "relates_to"];

export const isRelationType = (value: unknown): value is TIssueRelationTypes => isOneOf(RELATION_TYPES, value);
