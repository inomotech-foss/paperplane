/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TFilterValue } from "../expression";
import type { TBaseFilterFieldConfig } from "./shared";

/**
 * Extended filter types
 */
export const EXTENDED_FILTER_FIELD_TYPE = {
  NUMBER: "number",
  TEXT: "text",
} as const;

// -------- NUMBER FILTER CONFIGURATION --------

/**
 * Number filter configuration - for numeric comparisons (e.g. custom
 * NUMBER work item properties filtered with gt / lt).
 * - defaultValue: Initial numeric value
 */
export type TNumberFilterFieldConfig<V extends TFilterValue> = TBaseFilterFieldConfig & {
  type: typeof EXTENDED_FILTER_FIELD_TYPE.NUMBER;
  defaultValue?: V;
};

// -------- TEXT FILTER CONFIGURATION --------

/**
 * Text filter configuration - free text matched with `icontains` (the title, text
 * custom properties).
 * - defaultValue: Initial text
 * - placeholder: Hint shown while the input is empty
 */
export type TTextFilterFieldConfig<V extends TFilterValue> = TBaseFilterFieldConfig & {
  type: typeof EXTENDED_FILTER_FIELD_TYPE.TEXT;
  defaultValue?: V;
  placeholder?: string;
};

// -------- UNION TYPES --------

/**
 * All extended filter configurations
 */
export type TExtendedFilterFieldConfigs<V extends TFilterValue = TFilterValue> =
  | TNumberFilterFieldConfig<V>
  | TTextFilterFieldConfig<V>;
