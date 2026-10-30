/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { STATE_GROUPS } from "@plane/constants";
import type { TStateGroups } from "@plane/types";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isOneOf = <T>(values: readonly T[], value: unknown): value is T => values.some((item) => item === value);

/** Reads a field from an unknown value, such as an API error body. */
export const getField = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

export const getStringField = (value: unknown, key: string): string | undefined => {
  const field = getField(value, key);
  return typeof field === "string" ? field : undefined;
};

/** Checks whether an API error field (a string or a list of codes) contains a code. */
export const errorFieldIncludes = (error: unknown, key: string, code: string): boolean => {
  const field = getField(error, key);
  if (typeof field === "string") return field.includes(code);
  return Array.isArray(field) && field.includes(code);
};

const STATE_GROUP_KEYS = Object.values(STATE_GROUPS).map((group) => group.key);

export const isStateGroup = (value: unknown): value is TStateGroups => isOneOf(STATE_GROUP_KEYS, value);
