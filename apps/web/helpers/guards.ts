/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export const isOneOf = <T>(values: readonly T[], value: unknown): value is T => values.some((item) => item === value);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const readString = (value: unknown, key: string): string | undefined => {
  const field = isRecord(value) ? value[key] : undefined;
  return typeof field === "string" ? field : undefined;
};

export const readNumber = (value: unknown, key: string): number | undefined => {
  const field = isRecord(value) ? value[key] : undefined;
  return typeof field === "number" ? field : undefined;
};

export const isPresent = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined;
