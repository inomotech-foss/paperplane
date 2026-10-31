/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ISSUE_PRIORITIES, STATE_GROUPS } from "@plane/constants";
import type { TIssuePriorities, TStateGroups } from "@plane/types";

export const isOneOf = <T>(values: readonly T[], value: unknown): value is T => values.some((item) => item === value);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const getField = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

const PRIORITY_KEYS = ISSUE_PRIORITIES.map((priority) => priority.key);
const STATE_GROUP_KEYS = Object.values(STATE_GROUPS).map((group) => group.key);

export const isIssuePriority = (value: unknown): value is TIssuePriorities => isOneOf(PRIORITY_KEYS, value);

export const isStateGroup = (value: unknown): value is TStateGroups => isOneOf(STATE_GROUP_KEYS, value);
