/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { CornerDownRight, Sigma } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { TIssueCustomProperty, TIssueCustomPropertyValue } from "@plane/types";
import { cn } from "@plane/utils";
// components
import {
  getLookupConfig,
  getRollupConfig,
  isWorkItemReferenceProperty,
} from "@/components/custom-properties/derivation";
import { useFormatCustomPropertyValue } from "@/components/issues/issue-layouts/properties/custom-properties";
// hooks
import { useIssueCustomProperties } from "@/hooks/store/use-issue-custom-properties";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssueTypes } from "@/hooks/store/use-issue-types";
import { useProject } from "@/hooks/store/use-project";

/**
 * One line saying where a derived property's values come from, e.g. "Sum of Invoice
 * amount of Invoices below" or "The Customer above".
 */
export const useDescribeDerivation = () => {
  const { t } = useTranslation();
  const { getPropertyById } = useIssueCustomProperties();
  const { getIssueTypeById } = useIssueTypes();

  return (property: TIssueCustomProperty): string | undefined => {
    if (property.derivation === "INHERIT") return t("work_item_custom_properties.derivation.summary_inherit");
    const lookup = getLookupConfig(property);
    if (lookup) {
      const type = getIssueTypeById(lookup.issue_type)?.name ?? "";
      if (lookup.source === "item") return t("work_item_custom_properties.derivation.summary_lookup_item", { type });
      const source = getPropertyById(lookup.source)?.display_name ?? "";
      return t("work_item_custom_properties.derivation.summary_lookup_property", { type, property: source });
    }
    const rollup = getRollupConfig(property);
    if (rollup) {
      const fn = t(`work_item_custom_properties.derivation.functions.${rollup.function}`);
      const source =
        rollup.source === "items" || rollup.source === "start_date" || rollup.source === "target_date"
          ? t(`work_item_custom_properties.derivation.source_${rollup.source}`)
          : (getPropertyById(rollup.source)?.display_name ?? "");
      const type = rollup.issue_type ? getIssueTypeById(rollup.issue_type)?.name : undefined;
      return type
        ? t("work_item_custom_properties.derivation.summary_rollup_typed", { function: fn, source, type })
        : t("work_item_custom_properties.derivation.summary_rollup", { function: fn, source });
    }
    return undefined;
  };
};

type TWorkItemReferenceProps = {
  issueId: string;
  projectId: string;
  className?: string;
};

/** A work item a property value points at: its identifier and name, opening it on click. */
export const WorkItemReference = observer(function WorkItemReference(props: TWorkItemReferenceProps) {
  const { issueId, projectId, className } = props;
  const { workspaceSlug } = useParams();
  const {
    issue: { getIssueById },
    setPeekIssue,
  } = useIssueDetail();
  const { ensureWorkItemsLoaded } = useIssueCustomProperties();
  const { getProjectIdentifierById } = useProject();

  const workItem = getIssueById(issueId);

  useEffect(() => {
    if (!workItem && workspaceSlug) ensureWorkItemsLoaded(workspaceSlug.toString(), projectId, [issueId]);
  }, [workItem, workspaceSlug, projectId, issueId, ensureWorkItemsLoaded]);

  if (!workItem) return <span className={cn("truncate text-placeholder", className)}>…</span>;

  const identifier = `${getProjectIdentifierById(workItem.project_id) ?? ""}-${workItem.sequence_id}`;
  return (
    <button
      type="button"
      className={cn("flex min-w-0 items-center gap-1 truncate text-left hover:underline", className)}
      onClick={(e) => {
        e.stopPropagation();
        if (workspaceSlug && workItem.project_id)
          setPeekIssue({ workspaceSlug: workspaceSlug.toString(), projectId: workItem.project_id, issueId });
      }}
    >
      <span className="flex-shrink-0 text-tertiary">{identifier}</span>
      <span className="truncate">{workItem.name}</span>
    </button>
  );
});

type TDerivedValueProps = {
  property: TIssueCustomProperty;
  projectId: string;
  value: TIssueCustomPropertyValue | undefined;
};

/**
 * A value computed from the hierarchy (looked up or rolled up): shown read-only, with an
 * icon whose tooltip says where it comes from.
 */
export const CustomPropertyDerivedValue = observer(function CustomPropertyDerivedValue(props: TDerivedValueProps) {
  const { property, projectId, value } = props;
  const { t } = useTranslation();
  const describe = useDescribeDerivation();
  const formatValue = useFormatCustomPropertyValue();

  const Icon = property.derivation === "ROLLUP" ? Sigma : CornerDownRight;
  const isEmpty = value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length);
  const formatted = isEmpty || isWorkItemReferenceProperty(property) ? undefined : formatValue(property, value);

  return (
    <div className="flex h-full w-full min-w-0 items-center gap-1.5 px-2 py-0.5 text-body-xs-regular text-secondary">
      <Tooltip
        label={[t("work_item_custom_properties.derivation.computed_readonly"), describe(property)]
          .filter(Boolean)
          .join(": ")}
        layout="stacked"
      >
        <Icon className="size-3 flex-shrink-0 text-placeholder" aria-label={describe(property)} />
      </Tooltip>
      {isEmpty ? (
        <span className="text-placeholder">—</span>
      ) : isWorkItemReferenceProperty(property) && typeof value === "string" ? (
        <WorkItemReference issueId={value} projectId={projectId} />
      ) : (
        <span className="truncate">{formatted}</span>
      )}
    </div>
  );
});

type TInheritedValueHintProps = {
  sourceIssueId: string;
  projectId: string;
};

/** Marks a value taken from an ancestor, naming the work item it comes from. */
export const InheritedValueHint = observer(function InheritedValueHint(props: TInheritedValueHintProps) {
  const { sourceIssueId, projectId } = props;
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { ensureWorkItemsLoaded } = useIssueCustomProperties();
  const { getProjectIdentifierById } = useProject();

  const source = getIssueById(sourceIssueId);

  useEffect(() => {
    if (!source && workspaceSlug) ensureWorkItemsLoaded(workspaceSlug.toString(), projectId, [sourceIssueId]);
  }, [source, workspaceSlug, projectId, sourceIssueId, ensureWorkItemsLoaded]);

  const heading = t("work_item_custom_properties.derivation.inherited_from");
  // the tooltip takes plain text: name the work item the value comes from
  const label = source
    ? `${heading}: ${getProjectIdentifierById(source.project_id) ?? ""}-${source.sequence_id} ${source.name}`
    : heading;

  return (
    <Tooltip label={label} layout="stacked">
      <span className="flex flex-shrink-0 items-center px-1 text-placeholder">
        <CornerDownRight className="size-3" aria-label={heading} />
      </span>
    </Tooltip>
  );
});
