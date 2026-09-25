/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/** Result of validating a Plane Query Language expression without running it. */
export type TWorkItemQueryValidation = {
  valid: boolean;
  /** The `filters` AST the expression parsed into, when valid. */
  expression?: unknown;
  error?: string;
  /** Character offset of a syntax error, when the query did not parse. */
  position?: number;
  line?: number;
  column?: number;
  token?: string | null;
  expected?: string | null;
  field?: string | null;
};

export type TWorkItemQueryField = {
  name: string;
  type: "uuid" | "text" | "date";
  lookups: string[];
  choices: string[] | null;
  aliases: string[];
};

/** The vocabulary of Plane Query Language, for hints and completion. */
export type TWorkItemQueryFields = {
  fields: TWorkItemQueryField[];
  unsupported: Record<string, string>;
  functions: string[];
  custom_property_syntax: string;
};
