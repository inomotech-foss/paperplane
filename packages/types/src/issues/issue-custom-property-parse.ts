// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ApiSchema } from "@plane/api-types";
import { z } from "zod";
import { isPlainObject } from "../client-json/parse";
import type {
  TBulkIssueCustomPropertyValues,
  TIssueCustomProperty,
  TIssueCustomPropertyDerivationConfig,
  TIssueCustomPropertyValue,
  TIssueCustomPropertyValueMap,
  TIssueCustomPropertyValuesResponse,
} from "./issue-custom-property";

const lookupConfigSchema = z.object({
  issue_type: z.string(),
  source: z.string(),
  include_self: z.boolean(),
});

const rollupConfigSchema = z.object({
  source: z.string(),
  function: z.enum(["sum", "avg", "min", "max", "count", "earliest", "latest", "count_true", "percent_true"]),
  scope: z.enum(["children", "descendants"]),
  issue_type: z.string().nullable(),
  include_self: z.boolean(),
});

/** The backend validates derivation_config, so anything else means no derivation settings. */
export function parseDerivationConfig(value: unknown): TIssueCustomPropertyDerivationConfig {
  const rollup = rollupConfigSchema.safeParse(value);
  if (rollup.success) return rollup.data;
  const lookup = lookupConfigSchema.safeParse(value);
  if (lookup.success) return lookup.data;
  return {};
}

export const isIssueCustomPropertyValue = (value: unknown): value is TIssueCustomPropertyValue =>
  value === null ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  (Array.isArray(value) && value.every((item) => typeof item === "string"));

/** Keeps the entries whose value has a shape the client can show. */
export function parsePropertyValueMap(value: unknown): TIssueCustomPropertyValueMap {
  if (!isPlainObject(value)) return {};
  const map: TIssueCustomPropertyValueMap = {};
  for (const [key, entry] of Object.entries(value)) if (isIssueCustomPropertyValue(entry)) map[key] = entry;
  return map;
}

export function parseIssueCustomProperty(property: ApiSchema<"IssueProperty">): TIssueCustomProperty {
  return {
    ...property,
    relation_type: property.relation_type || null,
    settings: isPlainObject(property.settings) ? property.settings : {},
    derivation_config: parseDerivationConfig(property.derivation_config),
  };
}

export function parsePropertyValuesResponse(response: ApiSchema<"PropertyValues">): TIssueCustomPropertyValuesResponse {
  const derived: NonNullable<TIssueCustomPropertyValuesResponse["derived"]> = {};
  for (const [propertyId, source] of Object.entries(response.derived))
    derived[propertyId] = { source_issue_id: source.source_issue_id ?? null };
  return {
    values: parsePropertyValueMap(response.values),
    display: parsePropertyValueMap(response.display),
    derived,
  };
}

export function parseBulkPropertyValues(response: Record<string, unknown>): TBulkIssueCustomPropertyValues {
  const values: TBulkIssueCustomPropertyValues = {};
  for (const [issueId, map] of Object.entries(response)) values[issueId] = parsePropertyValueMap(map);
  return values;
}
