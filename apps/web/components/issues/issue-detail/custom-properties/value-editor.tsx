/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Switch } from "@makeplane/propel/components/switch";
import { DateSelect } from "@plane/blocks/property-select";
import type { SelectVariant } from "@plane/blocks/select";
import type { TIssueCustomProperty, TIssueCustomPropertyValue } from "@plane/types";
import { cn, getDate, renderFormattedPayloadDate } from "@plane/utils";
// components
import { MemberSelect } from "@/components/dropdowns/member/member-select";
// local imports
import { CustomPropertyOptionSelect } from "./option-select";

type TCustomPropertyValueEditorProps = {
  property: TIssueCustomProperty;
  projectId: string;
  value: TIssueCustomPropertyValue | undefined;
  onChange: (value: TIssueCustomPropertyValue) => void;
  disabled?: boolean;
  /** Trigger chrome of the select-based editors. */
  variant?: SelectVariant;
};

type TTextInputProps = {
  type: "text" | "number";
  value: string;
  onCommit: (value: string) => void;
  placeholder: string;
  disabled: boolean;
};

function CustomPropertyInput(props: TTextInputProps) {
  const { type, value, onCommit, placeholder, disabled } = props;
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <input
      type={type}
      className={cn(
        "h-full w-full rounded-sm bg-transparent px-2 py-0.5 text-body-xs-regular outline-none placeholder:text-placeholder",
        { "hover:bg-layer-transparent-hover focus:bg-layer-transparent-hover": !disabled }
      )}
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

type TTypedEditorProps = Required<Omit<TCustomPropertyValueEditorProps, "value">> & {
  value: TCustomPropertyValueEditorProps["value"];
};

function TextValueEditor(props: TTypedEditorProps) {
  const { value, onChange, disabled } = props;
  const { t } = useTranslation();
  return (
    <CustomPropertyInput
      type="text"
      value={typeof value === "string" ? value : ""}
      onCommit={(draft) => onChange(draft === "" ? null : draft)}
      placeholder={t("work_item_custom_properties.enter_value")}
      disabled={disabled}
    />
  );
}

function DecimalValueEditor(props: TTypedEditorProps) {
  const { value, onChange, disabled } = props;
  const { t } = useTranslation();
  const handleCommit = (draft: string) => {
    if (draft === "") onChange(null);
    else if (!Number.isNaN(Number(draft))) onChange(Number(draft));
  };
  return (
    <CustomPropertyInput
      type="number"
      value={typeof value === "number" ? String(value) : ""}
      onCommit={handleCommit}
      placeholder={t("work_item_custom_properties.enter_value")}
      disabled={disabled}
    />
  );
}

function OptionValueEditor(props: TTypedEditorProps) {
  const { property, value, onChange, disabled, variant } = props;
  if (property.is_multi) {
    return (
      <CustomPropertyOptionSelect
        property={property}
        value={Array.isArray(value) ? value : []}
        onChange={(selected) => onChange(selected)}
        multiple
        disabled={disabled}
        variant={variant}
      />
    );
  }
  return (
    <CustomPropertyOptionSelect
      property={property}
      value={typeof value === "string" ? value : null}
      onChange={(selected) => onChange(selected)}
      multiple={false}
      disabled={disabled}
      variant={variant}
    />
  );
}

function DateTimeValueEditor(props: TTypedEditorProps) {
  const { value, onChange, disabled, variant } = props;
  const { t } = useTranslation();
  const date = typeof value === "string" ? (getDate(value) ?? null) : null;
  return (
    <DateSelect
      value={date}
      onChange={(next) => onChange(next ? (renderFormattedPayloadDate(next) ?? null) : null)}
      placeholder={t("work_item_custom_properties.select_date")}
      variant={variant}
      clearable
      disabled={disabled}
    />
  );
}

function BooleanValueEditor(props: TTypedEditorProps) {
  const { property, value, onChange, disabled } = props;
  return (
    <div className="flex h-full items-center px-2">
      <Switch
        size="sm"
        checked={value === true}
        onCheckedChange={(next) => onChange(next)}
        disabled={disabled}
        aria-label={property.display_name}
      />
    </div>
  );
}

function RelationValueEditor(props: TTypedEditorProps) {
  const { projectId, value, onChange, disabled, variant } = props;
  const { t } = useTranslation();
  return (
    <MemberSelect
      value={typeof value === "string" ? value : null}
      onChange={(memberId) => onChange(memberId || null)}
      projectId={projectId}
      multiple={false}
      placeholder={t("work_item_custom_properties.select_member")}
      variant={variant}
      showLabel
      clearable
      disabled={disabled}
    />
  );
}

const VALUE_EDITORS: Partial<
  Record<TIssueCustomProperty["property_type"], (props: TTypedEditorProps) => React.ReactNode>
> = {
  TEXT: TextValueEditor,
  DECIMAL: DecimalValueEditor,
  OPTION: OptionValueEditor,
  DATETIME: DateTimeValueEditor,
  BOOLEAN: BooleanValueEditor,
  RELATION: RelationValueEditor,
};

export function CustomPropertyValueEditor(props: TCustomPropertyValueEditorProps) {
  const { property, projectId, value, onChange, disabled = false, variant = "select-ghost-md" } = props;
  const Editor = VALUE_EDITORS[property.property_type];
  if (!Editor) return null;
  return (
    <Editor
      property={property}
      projectId={projectId}
      value={value}
      onChange={onChange}
      disabled={disabled}
      variant={variant}
    />
  );
}
