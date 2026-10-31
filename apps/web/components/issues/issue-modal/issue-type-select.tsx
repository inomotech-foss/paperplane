/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";
// plane imports
import type { EditorRefApi } from "@plane/editor";
// types
import type { TIssue } from "@plane/types";
// components
import { IssueTypeDropdown } from "@/components/dropdowns/issue-type";

export type TIssueTypeDropdownVariant = "xs" | "sm";

export type TIssueTypeSelectProps = {
  control: Control<TIssue>;
  projectId: string | null;
  editorRef?: React.MutableRefObject<EditorRefApi | null>;
  disabled?: boolean;
  variant?: TIssueTypeDropdownVariant;
  placeholder?: string;
  isRequired?: boolean;
  renderChevron?: boolean;
  dropDownContainerClassName?: string;
  showMandatoryFieldInfo?: boolean; // Show info about mandatory fields
  handleFormChange?: () => void;
};

export function IssueTypeSelect(props: TIssueTypeSelectProps) {
  const { control, projectId, disabled, placeholder, dropDownContainerClassName, handleFormChange } = props;

  return (
    <Controller
      control={control}
      name="type_id"
      render={({ field: { value, onChange } }) => (
        <IssueTypeDropdown
          projectId={projectId}
          value={value ?? null}
          onChange={(val) => {
            onChange(val);
            handleFormChange?.();
          }}
          disabled={disabled}
          placeholder={placeholder}
          variant="pill-md"
          className={dropDownContainerClassName}
          tooltip
        />
      )}
    />
  );
}
