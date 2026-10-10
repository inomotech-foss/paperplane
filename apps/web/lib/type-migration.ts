// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { TIssueCustomProperty } from "@plane/types";
import type { TTypeMigrationProperty } from "@/services/issue/issue-type-migration.service";

/** What happens to the values of one property of the old type. Options map old ids to new ids, `null` drops. */
export type TPropertyDecision =
  | { kind: "drop" }
  | { kind: "target"; targetId: string; options: Record<string, string | null> };

const COMPUTED = new Set(["LOOKUP", "ROLLUP"]);

/** Properties of the new type that can hold the values of `source`. */
export const getCompatibleTargets = (
  source: TTypeMigrationProperty,
  properties: TIssueCustomProperty[],
  replacementTypeId: string
): TIssueCustomProperty[] =>
  properties.filter(
    (property) =>
      property.project === source.project_id &&
      property.is_active &&
      !COMPUTED.has(property.derivation) &&
      (property.issue_type === null || property.issue_type === replacementTypeId) &&
      property.property_type === source.property_type &&
      property.is_multi === source.is_multi &&
      (property.relation_type ?? null) === (source.relation_type ?? null)
  );

/** The used options of `source` without an option of the same name on `target`. */
export const getUnmatchedOptions = (
  source: TTypeMigrationProperty,
  target: TIssueCustomProperty | null | undefined
) => {
  const names = new Set((target?.options ?? []).map((option) => option.name));
  return source.options.filter((option) => !names.has(option.name));
};

/** Whether every property, and every option without a match by name, has a decision. */
export const isMappingComplete = (
  sources: TTypeMigrationProperty[],
  decisions: Record<string, TPropertyDecision | undefined>,
  getProperty: (propertyId: string) => TIssueCustomProperty | null
) =>
  sources.every((source) => {
    const decision = decisions[source.id];
    if (!decision) return false;
    if (decision.kind === "drop") return true;
    return getUnmatchedOptions(source, getProperty(decision.targetId)).every((option) => option.id in decision.options);
  });

/** The `property_mapping` of a migrate request. */
export const toPropertyMapping = (decisions: Record<string, TPropertyDecision | undefined>) => {
  const mapping: Record<string, { drop: true } | { target: string; options: Record<string, string | null> }> = {};
  for (const [propertyId, decision] of Object.entries(decisions)) {
    if (decision?.kind === "drop") mapping[propertyId] = { drop: true };
    else if (decision) mapping[propertyId] = { target: decision.targetId, options: decision.options };
  }
  return mapping;
};
