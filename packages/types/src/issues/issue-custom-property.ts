/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * Supported types of a work item custom property.
 */
export const ISSUE_CUSTOM_PROPERTY_TYPES = ["TEXT", "DECIMAL", "OPTION", "DATETIME", "BOOLEAN", "RELATION"] as const;

export type TIssueCustomPropertyType = (typeof ISSUE_CUSTOM_PROPERTY_TYPES)[number];

/**
 * A selectable option of an OPTION custom property.
 */
export type TIssueCustomPropertyOption = {
  id: string;
  name: string;
  sort_order: number;
  is_default: boolean;
  property: string;
  project: string;
  workspace: string;
};

/**
 * Where a property's values come from.
 * - NONE: people set them.
 * - INHERIT: a work item without its own value takes its parent's.
 * - LOOKUP: the nearest ancestor of a type, or one of its values (read-only).
 * - ROLLUP: an aggregate over the work items below (read-only).
 */
export const ISSUE_CUSTOM_PROPERTY_DERIVATIONS = ["NONE", "INHERIT", "LOOKUP", "ROLLUP"] as const;

export type TIssueCustomPropertyDerivation = (typeof ISSUE_CUSTOM_PROPERTY_DERIVATIONS)[number];

export type TIssueCustomPropertyRollupFunction =
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "count"
  | "earliest"
  | "latest"
  | "count_true"
  | "percent_true";

export type TIssueCustomPropertyLookupConfig = {
  /** The work item type of the ancestor to take the value from. */
  issue_type: string;
  /** "item" for the ancestor itself (a work item reference), else a property id. */
  source: "item" | string;
  /** Whether a work item of that type takes its own value (a customer is its own customer). */
  include_self: boolean;
};

export type TIssueCustomPropertyRollupConfig = {
  /** A property id, or a built-in: "items" (count work items), "start_date", "target_date". */
  source: "items" | "start_date" | "target_date" | string;
  function: TIssueCustomPropertyRollupFunction;
  scope: "children" | "descendants";
  /** Only count work items of this type, e.g. only invoices. */
  issue_type: string | null;
  include_self: boolean;
};

export type TIssueCustomPropertyDerivationConfig =
  | Record<string, never>
  | TIssueCustomPropertyLookupConfig
  | TIssueCustomPropertyRollupConfig;

/**
 * A custom property (typed custom field) defined on a project.
 */
export type TIssueCustomProperty = {
  id: string;
  name: string;
  display_name: string;
  property_type: TIssueCustomPropertyType;
  /** An OPTION property with `is_multi` holds several options at once. */
  is_multi: boolean;
  /**
   * What a RELATION property points at: a member, or a work item (only as a value
   * looked up from an ancestor).
   */
  relation_type: "USER" | "ISSUE" | null;
  is_active: boolean;
  is_required: boolean;
  sort_order: number;
  settings: Record<string, unknown>;
  options: TIssueCustomPropertyOption[];
  project: string;
  workspace: string;
  /**
   * The work item type this property is scoped to. `null` means the property
   * applies to all work item types of the project (unscoped).
   */
  issue_type: string | null;
  derivation: TIssueCustomPropertyDerivation;
  derivation_config: TIssueCustomPropertyDerivationConfig;
};

/**
 * The value of a single custom property on a work item. A multi-select
 * holds a list of option ids, OPTION / RELATION hold an id, DECIMAL a
 * number, BOOLEAN a boolean, DATETIME an ISO string and TEXT a string.
 */
export type TIssueCustomPropertyValue = string | number | boolean | string[] | null;

/**
 * Map of property id to value for one work item.
 */
export type TIssueCustomPropertyValueMap = Record<string, TIssueCustomPropertyValue>;

/**
 * Response of the property-values endpoints: raw values plus human readable
 * display values (option names, user display names).
 */
export type TIssueCustomPropertyValuesResponse = {
  values: TIssueCustomPropertyValueMap;
  display: TIssueCustomPropertyValueMap;
  /**
   * For each value computed from the hierarchy, the work item it was taken from
   * (null for roll-ups, which come from many).
   */
  derived?: Record<string, { source_issue_id: string | null }>;
};

/**
 * Response of the bulk property-values endpoint: map of work item id to its
 * property value map.
 */
export type TBulkIssueCustomPropertyValues = Record<string, TIssueCustomPropertyValueMap>;

/**
 * Display-property key under which a custom property is toggled on/off in
 * work item views.
 */
export type TIssueCustomPropertyDisplayKey = `custom_property_${string}`;

/**
 * The filter key of a custom property in work item filter expressions,
 * mirrored by the backend `property__<property_id>` query params.
 */
export type TIssueCustomPropertyFilterKey = `property__${string}`;
