/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
// plane imports
import type {
  TAutomationActionType,
  TAutomationChangeType,
  TAutomationConditionPropertyDefinition,
  TAutomationMetadata,
  TAutomationMutablePropertyDefinition,
  TAutomationOperator,
  TAutomationScope,
  TAutomationTriggerType,
  TAutomationValueSource,
} from "@plane/types";
// hooks
import { useAutomation } from "@/hooks/store/use-automation";

/**
 * Value sources the designer can render a picker for. A property whose source
 * isn't in this list is hidden rather than degraded to a raw id input.
 */
export const SUPPORTED_VALUE_SOURCES: TAutomationValueSource[] = [
  null,
  "states",
  "state_groups",
  "priorities",
  "members",
  "labels",
  "modules",
  "cycles",
  "projects",
];

export const isSupportedSource = (source: TAutomationValueSource): boolean => SUPPORTED_VALUE_SOURCES.includes(source);

/** Operators whose value is a plain number of days rather than a picker. */
export const DAY_COUNT_OPERATORS: TAutomationOperator[] = ["due_in_days", "overdue_by_days", "older_than_days"];

/** Operators that take no value at all. */
export const VALUELESS_OPERATORS: TAutomationOperator[] = ["is_empty", "is_not_empty", "changed"];

/**
 * Loads the trigger/condition/action catalog once per workspace.
 *
 * The catalog is static per deployment, so the store caches it for the session
 * and SWR only guards against the first render racing the fetch.
 */
export const useAutomationMetadata = (workspaceSlug: string) => {
  const { metadata, fetchMetadata } = useAutomation();

  const { isLoading, error } = useSWR(
    workspaceSlug ? `AUTOMATION_METADATA_${workspaceSlug}` : null,
    workspaceSlug ? () => fetchMetadata(workspaceSlug) : null,
    { revalidateOnFocus: false, revalidateIfStale: false }
  );

  return { metadata, isLoading: isLoading && !metadata, error };
};

/**
 * Keeps a freshly created automation's detail in sync when the designer is
 * opened directly by URL. Omit ``projectId`` for workspace-scoped automations.
 */
export const useAutomationDetails = (workspaceSlug: string, automationId: string, projectId?: string) => {
  const { getAutomationById, fetchAutomationDetails } = useAutomation();
  const automation = getAutomationById(automationId);

  const { isLoading, error } = useSWR(
    workspaceSlug && automationId ? `AUTOMATION_${automationId}` : null,
    workspaceSlug && automationId ? () => fetchAutomationDetails(workspaceSlug, automationId, projectId) : null
  );

  return { automation, isLoading: isLoading && !automation, error };
};

export const findTrigger = (metadata: TAutomationMetadata | undefined, key: TAutomationTriggerType | "") =>
  metadata?.triggers.find((trigger) => trigger.key === key);

export const findAction = (metadata: TAutomationMetadata | undefined, key: TAutomationActionType) =>
  metadata?.actions.find((action) => action.key === key);

export const findConditionProperty = (
  metadata: TAutomationMetadata | undefined,
  key: string
): TAutomationConditionPropertyDefinition | undefined =>
  metadata?.condition_properties.find((property) => property.key === key);

export const findMutableProperty = (
  metadata: TAutomationMetadata | undefined,
  key: string
): TAutomationMutablePropertyDefinition | undefined =>
  metadata?.mutable_properties.find((property) => property.key === key);

/**
 * Sources whose values only exist inside one project. A workspace-scoped
 * automation spans projects, so a state or label id picked from one of them is
 * meaningless — and the API rejects it — in every other project. Properties
 * backed by these are hidden at workspace scope rather than offered as a rule
 * that can never match.
 */
const PROJECT_LOCAL_SOURCES: TAutomationValueSource[] = [
  "states",
  "labels",
  "modules",
  "cycles",
  "work_item_types",
  "estimate_points",
];

const isReachableAtScope = (source: TAutomationValueSource, scope: TAutomationScope): boolean =>
  isSupportedSource(source) && !(scope === "workspace" && PROJECT_LOCAL_SOURCES.includes(source));

/** Condition properties the designer can offer a value picker for, at this scope. */
export const usableConditionProperties = (
  metadata: TAutomationMetadata | undefined,
  scope: TAutomationScope = "project"
) => (metadata?.condition_properties ?? []).filter((property) => isReachableAtScope(property.source, scope));

/** Mutable properties the designer can offer a value picker for, at this scope. */
export const usableMutableProperties = (
  metadata: TAutomationMetadata | undefined,
  scope: TAutomationScope = "project"
) => (metadata?.mutable_properties ?? []).filter((property) => isReachableAtScope(property.source, scope));

/**
 * Actions valid for the automation's trigger. Falls back to the whole catalog
 * while the trigger is still unset.
 */
export const allowedActions = (metadata: TAutomationMetadata | undefined, triggerType: TAutomationTriggerType | "") => {
  const trigger = findTrigger(metadata, triggerType);
  if (!trigger) return metadata?.actions ?? [];
  const allowed = new Set(trigger.allowed_actions);
  return (metadata?.actions ?? []).filter((action) => allowed.has(action.key));
};

/** i18n key for an operator label. */
export const operatorLabelKey = (operator: TAutomationOperator) => `automations.operators.${operator}`;

/** i18n key for a change-type label. */
export const changeTypeLabelKey = (changeType: TAutomationChangeType) => `automations.change_types.${changeType}`;
