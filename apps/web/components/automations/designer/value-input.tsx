/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import type { TAutomationPropertyKind, TAutomationValueSource } from "@plane/types";
// local imports
import { AutomationOptionSelect } from "../helpers/option-select";
import { useValueOptions } from "../helpers/use-value-options";

type Props = {
  /** Omitted for workspace-scoped rules, which have no single project. */
  projectId?: string;
  kind: TAutomationPropertyKind;
  source: TAutomationValueSource;
  /** `true` when the property accepts several values at once. */
  multiple: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
};

type TEditorProps = Pick<Props, "value" | "onChange" | "disabled">;

type TSourceProps = TEditorProps & {
  projectId?: string;
  source: NonNullable<TAutomationValueSource>;
};

const SourceMultiValueInput = observer(function SourceMultiValueInput(props: TSourceProps) {
  const { projectId, source, value, onChange, disabled } = props;
  const { t } = useTranslation();
  const { optionsFor, labelFor } = useValueOptions(projectId);
  const selected = Array.isArray(value) ? (value as string[]) : [];
  return (
    <AutomationOptionSelect
      multiple
      value={selected}
      options={optionsFor(source)}
      onChange={(next: string[]) => onChange(next)}
      disabled={disabled}
      label={
        selected.length === 0 ? (
          <span className="text-tertiary">{t("automations.designer.select_value")}</span>
        ) : (
          <span className="truncate">{selected.map((id) => labelFor(source, id)).join(", ")}</span>
        )
      }
      className="w-full"
    />
  );
});

const toSingleValue = (value: unknown): string | null =>
  Array.isArray(value) ? ((value as string[])[0] ?? null) : ((value as string) ?? null);

const SourceSingleValueInput = observer(function SourceSingleValueInput(props: TSourceProps) {
  const { projectId, source, value, onChange, disabled } = props;
  const { t } = useTranslation();
  const { optionsFor, labelFor } = useValueOptions(projectId);
  const selected = toSingleValue(value);
  return (
    <AutomationOptionSelect
      value={selected}
      options={optionsFor(source)}
      onChange={(next: string) => onChange(next)}
      disabled={disabled}
      label={
        selected ? (
          <span className="truncate">{labelFor(source, selected)}</span>
        ) : (
          <span className="text-tertiary">{t("automations.designer.select_value")}</span>
        )
      }
      className="w-full"
    />
  );
});

function BooleanValueInput(props: TEditorProps) {
  const { value, onChange, disabled } = props;
  const { t } = useTranslation();
  return (
    <AutomationOptionSelect
      value={value === true ? "true" : "false"}
      options={[
        { value: "true", query: t("common.yes") },
        { value: "false", query: t("common.no") },
      ]}
      onChange={(next: string) => onChange(next === "true")}
      disabled={disabled}
      label={value === true ? t("common.yes") : t("common.no")}
      className="w-full"
    />
  );
}

function DateValueInput(props: TEditorProps) {
  const { value, onChange, disabled } = props;
  return (
    <InputGroup size="md">
      <Input
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        size="md"
      />
    </InputGroup>
  );
}

function NumberValueInput(props: TEditorProps) {
  const { value, onChange, disabled } = props;
  const { t } = useTranslation();
  return (
    <InputGroup size="md">
      <Input
        type="number"
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
        disabled={disabled}
        placeholder={t("automations.designer.enter_value")}
        size="md"
      />
    </InputGroup>
  );
}

function TextValueInput(props: TEditorProps) {
  const { value, onChange, disabled } = props;
  const { t } = useTranslation();
  return (
    <InputGroup size="md">
      <Input
        type="text"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={t("automations.designer.enter_value")}
        size="md"
      />
    </InputGroup>
  );
}

/**
 * Renders the right editor for a property value: a picker when the property
 * declares a value source, otherwise a typed input matching its kind.
 */
export function AutomationValueInput(props: Props) {
  const { projectId, kind, source, multiple, value, onChange, disabled } = props;
  const editorProps = { value, onChange, disabled };

  if (source) {
    const SourceInput = multiple ? SourceMultiValueInput : SourceSingleValueInput;
    return <SourceInput projectId={projectId} source={source} {...editorProps} />;
  }
  if (kind === "boolean") return <BooleanValueInput {...editorProps} />;
  if (kind === "date") return <DateValueInput {...editorProps} />;
  if (kind === "number") return <NumberValueInput {...editorProps} />;
  return <TextValueInput {...editorProps} />;
}
