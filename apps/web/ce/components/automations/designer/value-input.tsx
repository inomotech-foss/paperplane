/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Input } from "@plane/propel/input";
import type { TAutomationPropertyKind, TAutomationValueSource } from "@plane/types";
import { CustomSearchSelect } from "@plane/ui";
// local imports
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

/**
 * Renders the right editor for a property value: a picker when the property
 * declares a value source, otherwise a typed input matching its kind.
 */
export const AutomationValueInput = observer(function AutomationValueInput(props: Props) {
  const { projectId, kind, source, multiple, value, onChange, disabled } = props;
  const { t } = useTranslation();
  const { optionsFor, labelFor } = useValueOptions(projectId);

  if (source) {
    const options = optionsFor(source);

    if (multiple) {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <CustomSearchSelect
          multiple
          value={selected}
          options={options}
          onChange={(next: string[]) => onChange(next)}
          disabled={disabled}
          input
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
    }

    const selected = Array.isArray(value) ? ((value as string[])[0] ?? null) : ((value as string) ?? null);
    return (
      <CustomSearchSelect
        value={selected}
        options={options}
        onChange={(next: string) => onChange(next)}
        disabled={disabled}
        input
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
  }

  if (kind === "boolean") {
    return (
      <CustomSearchSelect
        value={value === true ? "true" : "false"}
        options={[
          { value: "true", query: t("common.yes"), content: t("common.yes") },
          { value: "false", query: t("common.no"), content: t("common.no") },
        ]}
        onChange={(next: string) => onChange(next === "true")}
        disabled={disabled}
        input
        label={value === true ? t("common.yes") : t("common.no")}
        className="w-full"
      />
    );
  }

  if (kind === "date") {
    return (
      <Input
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full"
      />
    );
  }

  if (kind === "number") {
    return (
      <Input
        type="number"
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
        disabled={disabled}
        placeholder={t("automations.designer.enter_value")}
        className="w-full"
      />
    );
  }

  return (
    <Input
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      placeholder={t("automations.designer.enter_value")}
      className="w-full"
    />
  );
});
