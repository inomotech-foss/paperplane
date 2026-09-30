/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { Switch } from "@makeplane/propel/components/switch";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import { Select } from "@plane/blocks/select";
import { setToast } from "@plane/blocks/toast";
import type {
  TIssueCustomProperty,
  TIssueCustomPropertyDerivation,
  TIssueCustomPropertyLookupConfig,
  TIssueCustomPropertyRollupConfig,
  TIssueCustomPropertyRollupFunction,
  TIssueCustomPropertyType,
  TLogoProps,
} from "@plane/types";
import { ISSUE_CUSTOM_PROPERTY_DERIVATIONS, ISSUE_CUSTOM_PROPERTY_TYPES } from "@plane/types";
import { cn } from "@plane/utils";
// local imports
import { CustomPropertyIcon } from "@/components/issues/issue-detail/custom-properties/property-icon";
import { useIssueCustomProperties } from "@/hooks/store/use-issue-custom-properties";
import { useIssueTypes } from "@/hooks/store/use-issue-types";
import {
  ROLLUP_BUILTIN_SOURCES,
  getLookupConfig,
  getRollupConfig,
  getRollupFunctions,
  getRollupResultType,
  isDerivationSource,
} from "./derivation";

export type TCustomPropertyOperationsCallbacks = {
  createProperty: (data: Partial<TIssueCustomProperty>) => Promise<TIssueCustomProperty>;
  updateProperty: (propertyId: string, data: Partial<TIssueCustomProperty>) => Promise<TIssueCustomProperty>;
};

type TIssueTypeOption = { id: string; name: string; logo_props?: TLogoProps };

type TCreateUpdateCustomPropertyFormProps = {
  propertyToUpdate?: TIssueCustomProperty;
  operationsCallbacks: TCustomPropertyOperationsCallbacks;
  onClose: () => void;
};

const DEFAULT_LOOKUP: TIssueCustomPropertyLookupConfig = { issue_type: "", source: "item", include_self: true };
const DEFAULT_ROLLUP: TIssueCustomPropertyRollupConfig = {
  source: "items",
  function: "count",
  scope: "descendants",
  issue_type: null,
  include_self: false,
};

/** The translation key of a property type label; a work item reference has its own. */
export const getPropertyTypeLabelKey = (propertyType: TIssueCustomPropertyType, relationType?: string | null) =>
  propertyType === "RELATION" && relationType === "ISSUE"
    ? "work_item_custom_properties.types.work_item"
    : `work_item_custom_properties.types.${propertyType.toLowerCase()}`;

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

export const CreateUpdateCustomPropertyForm = observer(function CreateUpdateCustomPropertyForm(
  props: TCreateUpdateCustomPropertyFormProps
) {
  const { propertyToUpdate, operationsCallbacks, onClose } = props;
  // router
  const { projectId } = useParams();
  // i18n
  const { t } = useTranslation();
  // store hooks
  const { getActiveProjectIssueTypes, getIssueTypeById } = useIssueTypes();
  const { getProjectProperties, getPropertyById } = useIssueCustomProperties();
  // states
  const [displayName, setDisplayName] = useState(propertyToUpdate?.display_name ?? "");
  const [propertyType, setPropertyType] = useState<TIssueCustomPropertyType>(propertyToUpdate?.property_type ?? "TEXT");
  const [issueType, setIssueType] = useState<string | null>(propertyToUpdate?.issue_type ?? null);
  const [derivation, setDerivation] = useState<TIssueCustomPropertyDerivation>(propertyToUpdate?.derivation ?? "NONE");
  const [lookup, setLookup] = useState<TIssueCustomPropertyLookupConfig>(
    (propertyToUpdate && getLookupConfig(propertyToUpdate)) || DEFAULT_LOOKUP
  );
  const [rollup, setRollup] = useState<TIssueCustomPropertyRollupConfig>(
    (propertyToUpdate && getRollupConfig(propertyToUpdate)) || DEFAULT_ROLLUP
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  // derived values
  const issueTypes = getActiveProjectIssueTypes(projectId?.toString()) ?? [];
  const selectedIssueType = getIssueTypeById(issueType);
  // "" stands for "applies to all types" (a null issue_type)
  const issueTypeOptions: TIssueTypeOption[] = [
    { id: "", name: t("work_item_custom_properties.settings.applies_to_all_types") },
    ...issueTypes.map((type) => ({ id: type.id, name: type.name, logo_props: type.logo_props })),
  ];
  const sourceProperties = (getProjectProperties(projectId?.toString()) ?? []).filter(
    (property) => isDerivationSource(property) && property.id !== propertyToUpdate?.id
  );
  const lookupSource = lookup.source === "item" ? null : getPropertyById(lookup.source);
  const rollupSource = (ROLLUP_BUILTIN_SOURCES as readonly string[]).includes(rollup.source)
    ? null
    : getPropertyById(rollup.source);
  const rollupFunctions = getRollupFunctions(rollup.source, rollupSource);

  useEffect(() => {
    setDisplayName(propertyToUpdate?.display_name ?? "");
    setPropertyType(propertyToUpdate?.property_type ?? "TEXT");
    setIssueType(propertyToUpdate?.issue_type ?? null);
    setDerivation(propertyToUpdate?.derivation ?? "NONE");
    setLookup((propertyToUpdate && getLookupConfig(propertyToUpdate)) || DEFAULT_LOOKUP);
    setRollup((propertyToUpdate && getRollupConfig(propertyToUpdate)) || DEFAULT_ROLLUP);
  }, [propertyToUpdate]);

  const isUpdating = !!propertyToUpdate;

  // the type follows from the derivation for looked up and rolled up values
  const resolved: { type: TIssueCustomPropertyType; relationType: "USER" | "ISSUE" | null; isMulti: boolean } =
    derivation === "LOOKUP"
      ? lookup.source === "item"
        ? { type: "RELATION", relationType: "ISSUE", isMulti: false }
        : {
            type: lookupSource?.property_type ?? propertyType,
            relationType: lookupSource?.relation_type ?? null,
            isMulti: !!lookupSource?.is_multi,
          }
      : derivation === "ROLLUP"
        ? { type: getRollupResultType(rollup.function), relationType: null, isMulti: false }
        : { type: propertyType, relationType: propertyType === "RELATION" ? "USER" : null, isMulti: false };
  const isTypeDerived = derivation === "LOOKUP" || derivation === "ROLLUP";
  const isConfigComplete = derivation !== "LOOKUP" || !!lookup.issue_type;

  const derivationConfig =
    derivation === "LOOKUP" ? lookup : derivation === "ROLLUP" ? rollup : ({} as Record<string, never>);

  const handleSubmit = async () => {
    const trimmedName = displayName.trim();
    if (!trimmedName || !isConfigComplete) return;
    setIsSubmitting(true);
    try {
      if (isUpdating)
        await operationsCallbacks.updateProperty(propertyToUpdate.id, {
          display_name: trimmedName,
          issue_type: issueType,
          derivation,
          derivation_config: derivationConfig,
        });
      else
        await operationsCallbacks.createProperty({
          name: trimmedName,
          display_name: trimmedName,
          property_type: resolved.type,
          relation_type: resolved.relationType,
          is_multi: resolved.isMulti,
          issue_type: issueType,
          derivation,
          derivation_config: derivationConfig,
        });
      onClose();
    } catch (error) {
      const details = error as { error?: string; derivation_config?: string | string[] };
      const derivationError = Array.isArray(details?.derivation_config)
        ? details.derivation_config[0]
        : details?.derivation_config;
      setToast({
        type: "error",
        title: t("common.error.label"),
        message:
          derivationError ??
          details?.error ??
          t(
            isUpdating
              ? "work_item_custom_properties.settings.update_error"
              : "work_item_custom_properties.settings.create_error"
          ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
    <form
      className="flex w-full flex-col gap-2 rounded-sm border border-subtle bg-surface-1 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <div className="flex w-full items-center gap-2">
        <Select<TIssueCustomPropertyType>
          getValues={() => [...ISSUE_CUSTOM_PROPERTY_TYPES]}
          value={resolved.type}
          onChange={(value) => {
            if (value) setPropertyType(value as TIssueCustomPropertyType);
          }}
          getOptionValue={(type) => type}
          getOptionLabel={(type) => t(getPropertyTypeLabelKey(type))}
          getOptionIcon={(type) => <CustomPropertyIcon propertyType={type} className="size-3.5" />}
          showSearch={false}
          pinSelected={false}
          disabled={isUpdating || isTypeDerived}
        >
          <Select.Trigger<TIssueCustomPropertyType>
            variant="select-md"
            className="w-auto"
            disabled={isUpdating || isTypeDerived}
            prependIcon={
              <CustomPropertyIcon
                propertyType={resolved.type}
                relationType={resolved.relationType}
                className="size-3.5"
              />
            }
          >
            <span className="min-w-0 grow truncate text-left">
              {t(getPropertyTypeLabelKey(resolved.type, resolved.relationType))}
            </span>
          </Select.Trigger>
        </Select>
        <div className="w-full">
          <InputGroup size="md">
            <Input
              type="text"
              size="md"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("work_item_custom_properties.settings.name_placeholder")}
              aria-label={t("work_item_custom_properties.settings.name_placeholder")}
              // oxlint-disable-next-line jsx_a11y/no-autofocus
              autoFocus
            />
          </InputGroup>
        </div>
        {issueTypes.length > 0 && (
          <Select<TIssueTypeOption>
            getValues={() => issueTypeOptions}
            value={issueTypeOptions.find((option) => option.id === (issueType ?? "")) ?? null}
            onChange={(value) => setIssueType(value || null)}
            getOptionValue={(option) => option.id}
            getOptionLabel={(option) => option.name}
            getOptionIcon={(option) => (option.logo_props ? <Logo logo={option.logo_props} size={14} /> : undefined)}
            showSearch={false}
            pinSelected={false}
          >
            <Select.Trigger<TIssueTypeOption>
              variant="select-md"
              className="w-auto"
              prependIcon={selectedIssueType ? <Logo logo={selectedIssueType.logo_props} size={14} /> : undefined}
            >
              <span className="min-w-0 grow truncate text-left whitespace-nowrap">
                {selectedIssueType?.name ?? t("work_item_custom_properties.settings.applies_to_all_types")}
              </span>
            </Select.Trigger>
          </Select>
        )}
        <Button variant="secondary" onClick={onClose} size="xs" stretch="auto" label={t("common.cancel")} />
        <Button
          variant="primary"
          type="submit"
          size="xs"
          stretch="auto"
          loading={isSubmitting}
          disabled={!displayName.trim() || !isConfigComplete}
          label={isUpdating ? t("common.update") : t("common.create")}
        />
      </div>

      {/* where the values come from */}
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
                ...sourceProperties
                  .filter((property) => !(property.property_type === "RELATION" && property.relation_type === "ISSUE"))
                  .map((property) => ({
                    value: property.id,
                    label: property.display_name,
                    icon: propertyIcon(property),
                  })),
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
    </form>
  );
});
