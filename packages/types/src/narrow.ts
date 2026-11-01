// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

/** A non-null object that is not an array. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A non-null object, arrays included. Use `isRecord` unless arrays must pass. */
export const isObject = (value: unknown): value is object => typeof value === "object" && value !== null;

export const isOneOf = <const T>(values: readonly T[], value: unknown): value is T =>
  values.some((item) => item === value);

/** The member of `values` that equals `value`. */
export const findLiteral = <const T>(values: readonly T[], value: unknown): T | undefined =>
  values.find((item) => item === value);

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => typeof item === "number");

/** A field of a record, or `undefined` when `value` is not a record. */
export const readField = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

export const readString = (value: unknown, key: string): string | undefined => {
  const field = readField(value, key);
  return typeof field === "string" ? field : undefined;
};

export const readNumber = (value: unknown, key: string): number | undefined => {
  const field = readField(value, key);
  return typeof field === "number" ? field : undefined;
};

export const readBoolean = (value: unknown, key: string): boolean | undefined => {
  const field = readField(value, key);
  return typeof field === "boolean" ? field : undefined;
};
