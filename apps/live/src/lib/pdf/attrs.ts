/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

type Attrs = Record<string, unknown> | undefined;

export const attrString = (attrs: Attrs, key: string): string | undefined => {
  const value = attrs?.[key];
  return typeof value === "string" ? value : undefined;
};

export const attrNumber = (attrs: Attrs, key: string): number | undefined => {
  const value = attrs?.[key];
  return typeof value === "number" ? value : undefined;
};

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "number");

export const attrNumberArray = (attrs: Attrs, key: string): number[] | undefined => {
  const value = attrs?.[key];
  return isNumberArray(value) ? value : undefined;
};
