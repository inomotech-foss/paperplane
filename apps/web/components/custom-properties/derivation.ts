/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type {
  TIssueCustomProperty,
  TIssueCustomPropertyDerivationConfig,
  TIssueCustomPropertyLookupConfig,
  TIssueCustomPropertyRollupConfig,
  TIssueCustomPropertyRollupFunction,
  TIssueCustomPropertyType,
} from "@plane/types";

/** Values that come only from the hierarchy, so nobody can set them. */
export const isComputedProperty = (property: TIssueCustomProperty | null | undefined) =>
  property?.derivation === "LOOKUP" || property?.derivation === "ROLLUP";

/** A property whose value is a work item (e.g. the customer a work item belongs to). */
export const isWorkItemReferenceProperty = (property: TIssueCustomProperty | null | undefined) =>
  property?.property_type === "RELATION" && property.relation_type === "ISSUE";

const isRollupConfig = (config: TIssueCustomPropertyDerivationConfig): config is TIssueCustomPropertyRollupConfig =>
  "function" in config && "scope" in config;

const isLookupConfig = (config: TIssueCustomPropertyDerivationConfig): config is TIssueCustomPropertyLookupConfig =>
  "source" in config && !isRollupConfig(config);

export const getLookupConfig = (property: TIssueCustomProperty) =>
  property.derivation === "LOOKUP" && isLookupConfig(property.derivation_config)
    ? property.derivation_config
    : undefined;

export const getRollupConfig = (property: TIssueCustomProperty) =>
  property.derivation === "ROLLUP" && isRollupConfig(property.derivation_config)
    ? property.derivation_config
    : undefined;

export const ROLLUP_BUILTIN_SOURCES = ["items", "start_date", "target_date"] as const;

/** The roll-up functions a source offers; mirrors `rollup_functions_for` in the API. */
export const getRollupFunctions = (
  source: string | undefined,
  sourceProperty: TIssueCustomProperty | null | undefined
): TIssueCustomPropertyRollupFunction[] => {
  if (source === "items") return ["count"];
  if (source === "start_date" || source === "target_date") return ["earliest", "latest", "count"];
  switch (sourceProperty?.property_type) {
    case "DECIMAL":
      return ["sum", "avg", "min", "max", "count"];
    case "DATETIME":
      return ["earliest", "latest", "count"];
    case "BOOLEAN":
      return ["count_true", "percent_true", "count"];
    case undefined:
      return [];
    default:
      return ["count"];
  }
};

/** The type a roll-up's values have: dates for earliest / latest, numbers otherwise. */
export const getRollupResultType = (fn: TIssueCustomPropertyRollupFunction | undefined): TIssueCustomPropertyType =>
  fn === "earliest" || fn === "latest" ? "DATETIME" : "DECIMAL";

/** Properties a roll-up or look-up can read: ones people set, or inherited ones. */
export const isDerivationSource = (property: TIssueCustomProperty) =>
  property.derivation === "NONE" || property.derivation === "INHERIT";

/**
 * The property whose options an OPTION value refers to: a property looked up
 * from an option property of an ancestor shows the source's options.
 */
export const getOptionsProperty = (
  property: TIssueCustomProperty,
  getPropertyById: (propertyId: string) => TIssueCustomProperty | null
): TIssueCustomProperty => {
  const lookup = getLookupConfig(property);
  if (lookup && lookup.source !== "item") return getPropertyById(lookup.source) ?? property;
  return property;
};
