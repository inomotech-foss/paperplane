/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TFilterValue } from "../expression";
import type { TDateFilterFieldConfig, TNumberFilterFieldConfig, TTextFilterFieldConfig } from "../field-types";
import type { EXTENDED_COMPARISON_OPERATOR, EXTENDED_EQUALITY_OPERATOR } from "../operators/extended";

// ----------------------------- EXACT Operator -----------------------------
export type TExtendedExactOperatorConfigs = never;

// ----------------------------- IN Operator -----------------------------
export type TExtendedInOperatorConfigs = never;

// ----------------------------- RANGE Operator -----------------------------
export type TExtendedRangeOperatorConfigs = never;

// ----------------------------- GT / LT Operators -----------------------------
// numbers, and dates as "after" / "before"
export type TExtendedComparisonOperatorConfigs =
  | TNumberFilterFieldConfig<TFilterValue>
  | TDateFilterFieldConfig<TFilterValue>;

// ----------------------------- ICONTAINS Operator -----------------------------
export type TExtendedContainsOperatorConfigs = TTextFilterFieldConfig<TFilterValue>;

// ----------------------------- Extended Operator Specific Configs -----------------------------
export type TExtendedOperatorSpecificConfigs = {
  [EXTENDED_COMPARISON_OPERATOR.GT]: TExtendedComparisonOperatorConfigs;
  [EXTENDED_COMPARISON_OPERATOR.LT]: TExtendedComparisonOperatorConfigs;
  [EXTENDED_EQUALITY_OPERATOR.ICONTAINS]: TExtendedContainsOperatorConfigs;
};
