/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { observer } from "mobx-react";
// plane imports
import { Logo } from "@plane/blocks/emoji-icon-picker";
import { Select } from "@plane/blocks/select";
import type { SelectTooltip, SelectTooltipOverride, SelectVariant } from "@plane/blocks/select";
import { useTranslation } from "@plane/i18n";
import type { TIssueType } from "@plane/types";
// hooks
import { useIssueTypes } from "@/hooks/store/use-issue-types";

type Props = {
  projectId: string | null | undefined;
  value: string | null | undefined;
  onChange: (val: string) => void;
  variant: SelectVariant;
  disabled?: boolean;
  placeholder?: string;
  onClose?: () => void;
  className?: string;
  tooltip?: SelectTooltip;
  tabIndex?: number;
  /** Narrows the offered types, e.g. to the valid replacements of another type. */
  filterTypes?: (type: TIssueType) => boolean;
};

export const IssueTypeDropdown = observer(function IssueTypeDropdown(props: Props) {
  const {
    projectId,
    value,
    onChange,
    variant,
    disabled = false,
    placeholder,
    onClose,
    className,
    tooltip,
    tabIndex,
    filterTypes,
  } = props;
  const { t } = useTranslation();
  // store hooks
  const { getActiveProjectIssueTypes, getIssueTypeById } = useIssueTypes();
  // derived values
  const activeTypes = getActiveProjectIssueTypes(projectId) ?? [];
  const issueTypes = filterTypes ? activeTypes.filter(filterTypes) : activeTypes;
  const selectedType = getIssueTypeById(value);
  const resolvedPlaceholder = placeholder ?? t("work_item_types.label");

  const resolvedTooltip = useMemo<SelectTooltipOverride | undefined>(() => {
    if (!tooltip) return undefined;
    const override = typeof tooltip === "object" ? tooltip : undefined;
    return {
      heading: override?.heading ?? t("work_item_types.label"),
      emptyContent: override?.emptyContent ?? resolvedPlaceholder,
    };
  }, [tooltip, t, resolvedPlaceholder]);

  // Nothing to render if the project has no active work item types
  if (issueTypes.length === 0) return null;

  return (
    <Select<TIssueType>
      getValues={() => issueTypes}
      value={selectedType}
      onChange={onChange}
      disabled={disabled}
      placeholder={resolvedPlaceholder}
      searchPlaceholder={t("search")}
      emptyMessage={t("no_matching_results")}
      onClose={onClose}
      pinSelected={false}
      getOptionValue={(type) => type.id}
      getOptionLabel={(type) => type.name}
      getOptionIcon={(type) => <Logo logo={type.logo_props} size={14} />}
    >
      <Select.Trigger<TIssueType>
        disabled={disabled}
        variant={variant}
        tabIndex={tabIndex}
        className={className}
        prependIcon={(types) => (types[0] ? <Logo logo={types[0].logo_props} size={12} /> : undefined)}
        label={(types) => types[0]?.name ?? resolvedPlaceholder}
        tooltip={resolvedTooltip}
      >
        {(types) => <span className="min-w-0 grow truncate text-left">{types[0]?.name ?? resolvedPlaceholder}</span>}
      </Select.Trigger>
    </Select>
  );
});
