/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";

import { observer } from "mobx-react";
// plane imports
import type { TFilterValue, TFilterProperty } from "@plane/types";
import { FILTER_FIELD_TYPE } from "@plane/types";
import type { TFilterValueInputProps } from "../shared";
import { DateRangeFilterValueInput } from "./date/range";
import { SingleDateFilterValueInput } from "./date/single";
import { NumberFilterValueInput } from "./number";
import { MultiSelectFilterValueInput } from "./select/multi";
import { SingleSelectFilterValueInput } from "./select/single";
import { TextFilterValueInput } from "./text";

export const FilterValueInput = observer(function FilterValueInput<P extends TFilterProperty>(
  props: TFilterValueInputProps<P, TFilterValue>
) {
  const { condition, filterFieldConfig, isDisabled = false, onChange } = props;

  // Single select input
  if (filterFieldConfig?.type === FILTER_FIELD_TYPE.SINGLE_SELECT) {
    return (
      <SingleSelectFilterValueInput<P>
        config={filterFieldConfig}
        condition={condition}
        isDisabled={isDisabled}
        onChange={onChange}
      />
    );
  }

  // Multi select input
  if (filterFieldConfig?.type === FILTER_FIELD_TYPE.MULTI_SELECT) {
    return (
      <MultiSelectFilterValueInput<P>
        config={filterFieldConfig}
        condition={condition}
        isDisabled={isDisabled}
        onChange={onChange}
      />
    );
  }

  // Date filter input
  if (filterFieldConfig?.type === FILTER_FIELD_TYPE.DATE) {
    return (
      <SingleDateFilterValueInput<P>
        config={filterFieldConfig}
        condition={condition}
        isDisabled={isDisabled}
        onChange={onChange}
      />
    );
  }

  // Date range filter input
  if (filterFieldConfig?.type === FILTER_FIELD_TYPE.DATE_RANGE) {
    return (
      <DateRangeFilterValueInput<P>
        config={filterFieldConfig}
        condition={condition}
        isDisabled={isDisabled}
        onChange={onChange}
      />
    );
  }

  return <AdditionalFilterValueInput {...props} />;
});

export const AdditionalFilterValueInput = observer(function AdditionalFilterValueInput<P extends TFilterProperty>(
  props: TFilterValueInputProps<P, TFilterValue>
) {
  const { condition, filterFieldConfig, isDisabled = false, onChange } = props;

  // Number input (e.g. NUMBER custom properties with gt / lt operators)
  if (filterFieldConfig?.type === FILTER_FIELD_TYPE.NUMBER) {
    return <NumberFilterValueInput<P> condition={condition} isDisabled={isDisabled} onChange={onChange} />;
  }

  // Text input (the title, TEXT custom properties with contains)
  if (filterFieldConfig?.type === FILTER_FIELD_TYPE.TEXT) {
    return (
      <TextFilterValueInput<P>
        condition={condition}
        placeholder={filterFieldConfig.placeholder}
        isDisabled={isDisabled}
        onChange={onChange}
      />
    );
  }

  return (
    // Fallback
    <div className="flex h-full cursor-not-allowed items-center px-4 text-11 text-placeholder transition-opacity duration-200">
      Filter type not supported
    </div>
  );
});
