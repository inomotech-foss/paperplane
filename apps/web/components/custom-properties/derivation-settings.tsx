/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { Switch } from "@makeplane/propel/components/switch";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import { Select } from "@plane/blocks/select";
import { useTranslation } from "@plane/i18n";
import type {
  TIssueCustomProperty,
  TIssueCustomPropertyDerivation,
  TIssueCustomPropertyLookupConfig,
  TIssueCustomPropertyRollupConfig,
  TIssueCustomPropertyRollupFunction,
} from "@plane/types";
import { ISSUE_CUSTOM_PROPERTY_DERIVATIONS } from "@plane/types";
import { cn } from "@plane/utils";
// local imports
import { CustomPropertyIcon } from "@/components/issues/issue-detail/custom-properties/property-icon";
import { useIssueCustomProperties } from "@/hooks/store/use-issue-custom-properties";
import { useIssueTypes } from "@/hooks/store/use-issue-types";
import { ROLLUP_BUILTIN_SOURCES, getRollupFunctions } from "./derivation";

function FieldLabel(props: { children: React.ReactNode }) {
  return <span className="text-11 whitespace-nowrap text-tertiary">{props.children}</span>;
}

const propertyIcon = (property: TIssueCustomProperty) => (
  <CustomPropertyIcon
    propertyType={property.property_type}
    relationType={property.relation_type}
    className="size-3.5"
  />
);

type TPickOption = { value: string; label: string; icon?: React.ReactNode; description?: string };

/** A compact single select over a few fixed options, for the derivation settings. */
function PickOne(props: {
  options: TPickOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { options, value, onChange, placeholder, disabled } = props;
  const selected = options.find((option) => option.value === value) ?? null;
  return (
    <Select<TPickOption>
      getValues={() => options}
      value={selected}
      onChange={onChange}
      getOptionValue={(option) => option.value}
      getOptionLabel={(option) => option.label}
      getOptionIcon={(option) => option.icon}
      getOptionDescription={(option) => option.description}
      showSearch={options.length > 8}
      pinSelected={false}
      disabled={disabled}
    >
      <Select.Trigger<TPickOption>
        variant="select-md"
        className="w-auto"
        disabled={disabled}
        prependIcon={selected?.icon ? <>{selected.icon}</> : undefined}
      >
        <span className={cn("min-w-0 grow truncate text-left whitespace-nowrap", { "text-placeholder": !selected })}>
          {selected?.label ?? placeholder}
        </span>
      </Select.Trigger>
    </Select>
  );
}

type TDerivationSettingsProps = {
  derivation: TIssueCustomPropertyDerivation;
  onDerivationChange: (derivation: TIssueCustomPropertyDerivation) => void;
  lookup: TIssueCustomPropertyLookupConfig;
  onLookupChange: (lookup: TIssueCustomPropertyLookupConfig) => void;
  rollup: TIssueCustomPropertyRollupConfig;
  onRollupChange: (rollup: TIssueCustomPropertyRollupConfig) => void;
  /** The functions that fit the roll-up source. */
  rollupFunctions: TIssueCustomPropertyRollupFunction[];
  /** The properties a value can be looked up or rolled up from. */
  sourceProperties: TIssueCustomProperty[];
};

/** Where a custom field's values come from: people, the parent, an ancestor, or the work items below. */
export const DerivationSettings = observer(function DerivationSettings(props: TDerivationSettingsProps) {
  const {
    derivation,
    onDerivationChange: setDerivation,
    lookup,
    onLookupChange: setLookup,
    rollup,
    onRollupChange: setRollup,
    rollupFunctions,
    sourceProperties,
  } = props;
  const { projectId } = useParams();
  const { t } = useTranslation();
  const { getActiveProjectIssueTypes } = useIssueTypes();
  const { getPropertyById } = useIssueCustomProperties();
  const issueTypes = getActiveProjectIssueTypes(projectId?.toString()) ?? [];

  // "" stands for "none picked" in the pickers below
  const issueTypeSelect = (
    value: string | null,
    onChange: (value: string | null) => void,
    emptyLabel: string,
    allowEmpty = true
  ) => (
    <PickOne
      value={value ?? ""}
      onChange={(next) => onChange(next || null)}
      placeholder={emptyLabel}
      options={[
        ...(allowEmpty ? [{ value: "", label: emptyLabel }] : []),
        ...issueTypes.map((type) => ({
          value: type.id,
          label: type.name,
          icon: <Logo logo={type.logo_props} size={14} />,
        })),
      ]}
    />
  );

  const sourceLabel = (source: string) =>
    (ROLLUP_BUILTIN_SOURCES as readonly string[]).includes(source)
      ? t(`work_item_custom_properties.derivation.source_${source}`)
      : (getPropertyById(source)?.display_name ?? source);

  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 pl-1">
      <FieldLabel>{t("work_item_custom_properties.derivation.label")}</FieldLabel>
      <PickOne
        value={derivation}
        onChange={(value) => setDerivation(value as TIssueCustomPropertyDerivation)}
        options={ISSUE_CUSTOM_PROPERTY_DERIVATIONS.map((option) => ({
          value: option,
          label: t(`work_item_custom_properties.derivation.${option.toLowerCase()}`),
          description: t(`work_item_custom_properties.derivation.${option.toLowerCase()}_help`),
        }))}
      />

      {derivation === "LOOKUP" && (
        <>
          <FieldLabel>{t("work_item_custom_properties.derivation.ancestor_type")}</FieldLabel>
          {issueTypeSelect(
            lookup.issue_type || null,
            (value) => setLookup({ ...lookup, issue_type: value ?? "" }),
            t("work_item_custom_properties.derivation.pick_type"),
            false
          )}
          <FieldLabel>{t("work_item_custom_properties.derivation.take")}</FieldLabel>
          <PickOne
            value={lookup.source}
            onChange={(value) => setLookup({ ...lookup, source: value })}
            options={[
              { value: "item", label: t("work_item_custom_properties.derivation.the_item_itself") },
              // a work item reference cannot be looked up: "the work item itself" covers it
              ...sourceProperties.flatMap((property) =>
                property.property_type === "RELATION" && property.relation_type === "ISSUE"
                  ? []
                  : [{ value: property.id, label: property.display_name, icon: propertyIcon(property) }]
              ),
            ]}
          />
          <label className="flex items-center gap-1.5">
            <Switch
              size="sm"
              checked={lookup.include_self}
              onCheckedChange={(value) => setLookup({ ...lookup, include_self: value })}
            />
            <FieldLabel>{t("work_item_custom_properties.derivation.include_self_lookup")}</FieldLabel>
          </label>
        </>
      )}

      {derivation === "ROLLUP" && (
        <>
          <PickOne
            value={rollup.function}
            onChange={(value) => setRollup({ ...rollup, function: value as TIssueCustomPropertyRollupFunction })}
            options={rollupFunctions.map((fn) => ({
              value: fn,
              label: t(`work_item_custom_properties.derivation.functions.${fn}`),
            }))}
          />
          <FieldLabel>{t("work_item_custom_properties.derivation.of")}</FieldLabel>
          <PickOne
            value={rollup.source}
            onChange={(value) => {
              const functions = getRollupFunctions(value, getPropertyById(value));
              setRollup({
                ...rollup,
                source: value,
                function: functions.includes(rollup.function) ? rollup.function : (functions[0] ?? "count"),
              });
            }}
            options={[
              ...ROLLUP_BUILTIN_SOURCES.map((source) => ({ value: source, label: sourceLabel(source) })),
              ...sourceProperties.map((property) => ({
                value: property.id,
                label: property.display_name,
                icon: propertyIcon(property),
              })),
            ]}
          />
          <FieldLabel>{t("work_item_custom_properties.derivation.of_work_items")}</FieldLabel>
          {issueTypeSelect(
            rollup.issue_type,
            (value) => setRollup({ ...rollup, issue_type: value }),
            t("work_item_custom_properties.derivation.any_type")
          )}
          <PickOne
            value={rollup.scope}
            onChange={(value) => setRollup({ ...rollup, scope: value as TIssueCustomPropertyRollupConfig["scope"] })}
            options={[
              { value: "descendants", label: t("work_item_custom_properties.derivation.scope_descendants") },
              { value: "children", label: t("work_item_custom_properties.derivation.scope_children") },
            ]}
          />
          <label className="flex items-center gap-1.5">
            <Switch
              size="sm"
              checked={rollup.include_self}
              onCheckedChange={(value) => setRollup({ ...rollup, include_self: value })}
            />
            <FieldLabel>{t("work_item_custom_properties.derivation.include_self_rollup")}</FieldLabel>
          </label>
        </>
      )}
    </div>
  );
});
