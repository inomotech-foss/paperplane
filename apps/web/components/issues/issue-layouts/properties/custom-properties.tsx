/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { IIssueDisplayProperties, TIssueCustomProperty, TIssueCustomPropertyValue } from "@plane/types";
import { renderFormattedDate } from "@plane/utils";
// components
import { getOptionsProperty, isWorkItemReferenceProperty } from "@/components/custom-properties/derivation";
// hooks
import { useIssueCustomProperties } from "@/hooks/store/use-issue-custom-properties";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
// local imports
import { CustomPropertyIcon } from "@/components/issues/issue-detail/custom-properties/property-icon";

/**
 * Formats a custom property value into a short human readable string.
 * Returns undefined when there is nothing to display.
 */
export const useFormatCustomPropertyValue = () => {
  const { getUserDetails } = useMember();
  const { getPropertyById } = useIssueCustomProperties();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { getProjectIdentifierById } = useProject();
  const { t } = useTranslation();

  return (property: TIssueCustomProperty, value: TIssueCustomPropertyValue | undefined): string | undefined => {
    if (value === null || value === undefined || value === "") return undefined;
    switch (property.property_type) {
      case "OPTION": {
        // a property looked up from an ancestor's option property shows the source's options
        const options = getOptionsProperty(property, getPropertyById).options;
        if (!property.is_multi) {
          return options.find((candidate) => candidate.id === value)?.name;
        }
        if (!Array.isArray(value) || value.length === 0) return undefined;
        const names = value
          .map((optionId) => options.find((candidate) => candidate.id === optionId)?.name)
          .filter((name): name is string => !!name);
        return names.length > 0 ? names.join(", ") : undefined;
      }
      case "DATETIME":
        return typeof value === "string" ? renderFormattedDate(value) || undefined : undefined;
      case "BOOLEAN":
        return value === true ? t("common.yes") : t("common.no");
      case "RELATION": {
        if (typeof value !== "string") return undefined;
        if (!isWorkItemReferenceProperty(property)) return getUserDetails(value)?.display_name;
        const workItem = getIssueById(value);
        return workItem
          ? `${getProjectIdentifierById(workItem.project_id) ?? ""}-${workItem.sequence_id} ${workItem.name}`
          : undefined;
      }
      default:
        return String(value);
    }
  };
};

type TIssueCustomPropertyChipsProps = {
  projectId: string;
  issueId: string;
  displayProperties: IIssueDisplayProperties;
};

/**
 * Compact read-only chips of enabled custom property values, rendered on
 * list rows and kanban cards. Values come from the bulk values endpoint via
 * the custom property store.
 */
export const IssueCustomPropertyChips = observer(function IssueCustomPropertyChips(
  props: TIssueCustomPropertyChipsProps
) {
  const { projectId, issueId, displayProperties } = props;
  // router
  const { workspaceSlug } = useParams();
  // store hooks
  const { getActiveProjectProperties, getIssueValue, ensureWorkItemsLoaded } = useIssueCustomProperties();
  const formatValue = useFormatCustomPropertyValue();
  // derived values
  const properties = getActiveProjectProperties(projectId);
  // work items that shown values point at (e.g. the customer), for their names
  const referencedIds = (properties ?? [])
    .filter((property) => isWorkItemReferenceProperty(property) && displayProperties[`custom_property_${property.id}`])
    .map((property) => getIssueValue(issueId, property.id))
    .filter((value): value is string => typeof value === "string");
  const referencedKey = referencedIds.join(",");

  useEffect(() => {
    if (workspaceSlug && referencedKey)
      ensureWorkItemsLoaded(workspaceSlug.toString(), projectId, referencedKey.split(","));
  }, [workspaceSlug, projectId, referencedKey, ensureWorkItemsLoaded]);

  if (!properties || properties.length === 0) return null;

  return (
    <>
      {properties.map((property) => {
        if (!displayProperties[`custom_property_${property.id}`]) return null;
        const formattedValue = formatValue(property, getIssueValue(issueId, property.id));
        if (formattedValue === undefined) return null;
        return (
          <Tooltip key={property.id} label={`${property.display_name}: ${formattedValue}`}>
            <div className="flex h-5 max-w-40 flex-shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border-[0.5px] border-strong px-2.5 py-1">
              <CustomPropertyIcon
                propertyType={property.property_type}
                relationType={property.relation_type}
                className="h-3 w-3 flex-shrink-0"
              />
              <div className="truncate text-caption-sm-regular">{formattedValue}</div>
            </div>
          </Tooltip>
        );
      })}
    </>
  );
});
