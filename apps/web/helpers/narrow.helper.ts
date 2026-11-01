/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { STATE_GROUPS } from "@plane/constants";
import { isOneOf, readField } from "@plane/types";
import type { TStateGroups } from "@plane/types";

export const isString = (value: unknown): value is string => typeof value === "string";

export const isPresent = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined;

/** Keeps the string items of an unknown value, or returns an empty list when it is not an array. */
export const toStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter(isString) : []);

/** Reads a field that is a string or a list of strings, returning the first string. */
export const getFirstStringField = (value: unknown, key: string): string | undefined => {
  const field = readField(value, key);
  if (typeof field === "string") return field;
  if (!Array.isArray(field)) return undefined;
  const first: unknown = field[0];
  return typeof first === "string" ? first : undefined;
};

/** Checks whether an API error field (a string or a list of codes) contains a code. */
export const errorFieldIncludes = (error: unknown, key: string, code: string): boolean => {
  const field = readField(error, key);
  if (typeof field === "string") return field.includes(code);
  return Array.isArray(field) && field.includes(code);
};

const STATE_GROUP_KEYS = Object.values(STATE_GROUPS).map((group) => group.key);

export const isStateGroup = (value: unknown): value is TStateGroups => isOneOf(STATE_GROUP_KEYS, value);
