/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { sortBy } from "lodash-es";
import { useMemo } from "react";
// plane imports
import { Select } from "@plane/blocks/select";
import type { SelectVariant } from "@plane/blocks/select";
import { useTranslation } from "@plane/i18n";
import type { TIssueCustomProperty, TIssueCustomPropertyOption } from "@plane/types";

type TCustomPropertyOptionSelectProps = {
  property: TIssueCustomProperty;
  value: string | string[] | null;
  onChange: (value: string | string[] | null) => void;
  multiple: boolean;
  disabled?: boolean;
  variant: SelectVariant;
  className?: string;
};

export function CustomPropertyOptionSelect(props: TCustomPropertyOptionSelectProps) {
  const { property, value, onChange, multiple, disabled = false, variant, className } = props;
  // i18n
  const { t } = useTranslation();

  // Options can be very large (e.g. ~1000 customers); the Select list is virtualized.
  const sortedOptions = useMemo(() => sortBy(property.options, "sort_order"), [property.options]);
  const selectedIds = Array.isArray(value) ? value : value ? [value] : [];
  const selectedIdSet = new Set(selectedIds);
  const selectedOptions = sortedOptions.filter((option) => selectedIdSet.has(option.id));
  const placeholder = t("work_item_custom_properties.select_option");

  const commonProps = {
    getValues: () => sortedOptions,
    disabled,
    placeholder,
    searchPlaceholder: t("common.search.label"),
    emptyMessage: t("common.search.no_matching_results"),
    pinSelected: false,
    getOptionValue: (option: TIssueCustomPropertyOption) => option.id,
    getOptionLabel: (option: TIssueCustomPropertyOption) => option.name,
  };

  const trigger = (
    <Select.Trigger<TIssueCustomPropertyOption>
      disabled={disabled}
      variant={variant}
      className={className}
      label={(options) => (options.length > 0 ? options.map((option) => option.name).join(", ") : placeholder)}
    >
      {(options) => (
        <span className="min-w-0 grow truncate text-left">
          {options.length > 0 ? options.map((option) => option.name).join(", ") : placeholder}
        </span>
      )}
    </Select.Trigger>
  );

  if (multiple)
    return (
      <Select<TIssueCustomPropertyOption>
        {...commonProps}
        multiple
        value={selectedOptions}
        onChange={(ids) => onChange(ids)}
      >
        {trigger}
      </Select>
    );

  return (
    <Select<TIssueCustomPropertyOption>
      {...commonProps}
      value={selectedOptions[0] ?? null}
      // Selecting the already selected value in single-select mode clears it
      onChange={(id) => onChange(!id || id === value ? null : id)}
    >
      {trigger}
    </Select>
  );
}
