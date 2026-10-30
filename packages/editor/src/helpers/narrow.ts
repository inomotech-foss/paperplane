/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const readProperty = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

export const readString = (value: unknown, key: string): string | undefined => {
  const property = readProperty(value, key);
  return typeof property === "string" ? property : undefined;
};

// Tiptap's HTML parser turns all-digit attribute values into numbers.
export const readText = (value: unknown, key: string): string | undefined => {
  const property = readProperty(value, key);
  if (typeof property === "number" && Number.isFinite(property)) return String(property);
  return typeof property === "string" ? property : undefined;
};

export const readNumber = (value: unknown, key: string): number | undefined => {
  const property = readProperty(value, key);
  return typeof property === "number" ? property : undefined;
};

export const readBoolean = (value: unknown, key: string): boolean | undefined => {
  const property = readProperty(value, key);
  return typeof property === "boolean" ? property : undefined;
};

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  values.some((item) => item === value);
