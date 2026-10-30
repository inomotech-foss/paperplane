/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isString = (value: unknown): value is string => typeof value === "string";

/** Keeps the string items of an unknown value, or returns an empty list when it is not an array. */
export const toStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter(isString) : []);

/** Reads a string field from an unknown value, such as an API error body. */
export const getStringField = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) return undefined;
  const field = value[key];
  return typeof field === "string" ? field : undefined;
};

/** Reads a field that is a string or a list of strings, returning the first string. */
export const getFirstStringField = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) return undefined;
  const field: unknown = value[key];
  if (typeof field === "string") return field;
  if (!Array.isArray(field)) return undefined;
  const first: unknown = field[0];
  return typeof first === "string" ? first : undefined;
};

/** Checks whether an API error field (a string or a list of codes) contains a code. */
export const errorFieldIncludes = (error: unknown, key: string, code: string): boolean => {
  if (!isRecord(error)) return false;
  const field = error[key];
  if (typeof field === "string") return field.includes(code);
  return Array.isArray(field) && field.includes(code);
};

/** Returns the member of a string union list that equals `value`. */
export const findLiteral = <T extends string>(values: readonly T[], value: string): T | undefined =>
  values.find((member) => member === value);
