/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
// plane imports
import type {
  TIssueCustomProperty,
  TIssueCustomPropertyDerivation,
  TIssueCustomPropertyLookupConfig,
  TIssueCustomPropertyRollupConfig,
  TIssueCustomPropertyType,
} from "@plane/types";
// hooks
import { useIssueCustomProperties } from "@/hooks/store/use-issue-custom-properties";
// local imports
import {
  ROLLUP_BUILTIN_SOURCES,
  getLookupConfig,
  getRollupConfig,
  getRollupFunctions,
  getRollupResultType,
  isDerivationSource,
} from "./derivation";

const DEFAULT_LOOKUP: TIssueCustomPropertyLookupConfig = { issue_type: "", source: "item", include_self: true };
const DEFAULT_ROLLUP: TIssueCustomPropertyRollupConfig = {
  source: "items",
  function: "count",
  scope: "descendants",
  issue_type: null,
  include_self: false,
};

export type TResolvedPropertyType = {
  type: TIssueCustomPropertyType;
  relationType: "USER" | "ISSUE" | null;
  isMulti: boolean;
};

/**
 * The type a new property gets. It follows from the derivation for looked up values (the
 * work item itself, or the looked up property's type) and rolled up values (a number or
 * a date); otherwise it is the type picked in the form.
 */
const resolvePropertyType = (
  derivation: TIssueCustomPropertyDerivation,
  lookup: TIssueCustomPropertyLookupConfig,
  lookupSource: TIssueCustomProperty | null | undefined,
  rollup: TIssueCustomPropertyRollupConfig,
  pickedType: TIssueCustomPropertyType
): TResolvedPropertyType => {
  if (derivation === "LOOKUP" && lookup.source === "item")
    return { type: "RELATION", relationType: "ISSUE", isMulti: false };
  if (derivation === "LOOKUP")
    return {
      type: lookupSource?.property_type ?? pickedType,
      relationType: lookupSource?.relation_type ?? null,
      isMulti: !!lookupSource?.is_multi,
    };
  if (derivation === "ROLLUP")
    return { type: getRollupResultType(rollup.function), relationType: null, isMulti: false };
  return { type: pickedType, relationType: pickedType === "RELATION" ? "USER" : null, isMulti: false };
};

/**
 * The derivation settings being edited in the custom field form: where the values come
 * from, the look-up or roll-up settings, and what follows from them.
 */
export const useDerivationDraft = (projectId: string | undefined, propertyToUpdate?: TIssueCustomProperty) => {
  const { getProjectProperties, getPropertyById } = useIssueCustomProperties();
  const [derivation, setDerivation] = useState<TIssueCustomPropertyDerivation>(propertyToUpdate?.derivation ?? "NONE");
  const [lookup, setLookup] = useState<TIssueCustomPropertyLookupConfig>(
    (propertyToUpdate && getLookupConfig(propertyToUpdate)) || DEFAULT_LOOKUP
  );
  const [rollup, setRollup] = useState<TIssueCustomPropertyRollupConfig>(
    (propertyToUpdate && getRollupConfig(propertyToUpdate)) || DEFAULT_ROLLUP
  );

  // a property cannot derive from itself or from another computed one
  const sourceProperties = (getProjectProperties(projectId) ?? []).filter(
    (property) => isDerivationSource(property) && property.id !== propertyToUpdate?.id
  );
  const lookupSource = lookup.source === "item" ? null : getPropertyById(lookup.source);
  const rollupSource = (ROLLUP_BUILTIN_SOURCES as readonly string[]).includes(rollup.source)
    ? null
    : getPropertyById(rollup.source);

  let derivationConfig: TIssueCustomPropertyLookupConfig | TIssueCustomPropertyRollupConfig | Record<string, never> =
    {};
  if (derivation === "LOOKUP") derivationConfig = lookup;
  else if (derivation === "ROLLUP") derivationConfig = rollup;

  return {
    derivation,
    setDerivation,
    lookup,
    setLookup,
    rollup,
    setRollup,
    sourceProperties,
    rollupFunctions: getRollupFunctions(rollup.source, rollupSource),
    derivationConfig,
    /** The type comes from the derivation, so the form does not offer to pick it. */
    isTypeDerived: derivation === "LOOKUP" || derivation === "ROLLUP",
    /** A look-up needs the ancestor's type. */
    isComplete: derivation !== "LOOKUP" || !!lookup.issue_type,
    resolveType: (pickedType: TIssueCustomPropertyType) =>
      resolvePropertyType(derivation, lookup, lookupSource, rollup, pickedType),
  };
};
