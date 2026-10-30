/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/** Which PQL spelling the query bar completes and explains; the parser accepts both. */
export type TPqlDialect = "jql" | "plane";

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
  /** PQL operator strings the field accepts, in display order. */
  operators: string[];
  choices: string[] | null;
  aliases: string[];
  /** Plane's camelCase names for the field, e.g. `dueDate`. */
  plane_aliases: string[];
  /** Values are workspace members, so currentUser() applies. */
  people: boolean;
};

export type TWorkItemQueryFunction = {
  name: string;
  /**
   * A condition stands alone (`childOf("X")`); a value follows an operator (`now()`);
   * a list follows `in` (`stateGroup in openStates()`).
   */
  kind: "condition" | "value" | "list";
  /** How many arguments the function takes. */
  arguments: number;
};

/** The vocabulary of Plane Query Language, for hints and completion. */
export type TWorkItemQueryFields = {
  fields: TWorkItemQueryField[];
  unsupported: Record<string, string>;
  functions: TWorkItemQueryFunction[];
  custom_property_syntax: string;
};
