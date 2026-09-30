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
import { Logo } from "@plane/blocks/emoji-icon-picker";
import { Select } from "@plane/blocks/select";
import { setToast } from "@plane/blocks/toast";
import type { TIssueCustomProperty, TIssueCustomPropertyType, TLogoProps } from "@plane/types";
import { ISSUE_CUSTOM_PROPERTY_TYPES } from "@plane/types";
// local imports
import { CustomPropertyIcon } from "@/components/issues/issue-detail/custom-properties/property-icon";
import { useIssueTypes } from "@/hooks/store/use-issue-types";

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
  // states
  const [displayName, setDisplayName] = useState(propertyToUpdate?.display_name ?? "");
  const [propertyType, setPropertyType] = useState<TIssueCustomPropertyType>(propertyToUpdate?.property_type ?? "TEXT");
  const [issueType, setIssueType] = useState<string | null>(propertyToUpdate?.issue_type ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // derived values
  const issueTypes = getActiveProjectIssueTypes(projectId?.toString()) ?? [];
  const selectedIssueType = getIssueTypeById(issueType);
  // "" stands for "applies to all types" (a null issue_type)
  const issueTypeOptions: TIssueTypeOption[] = [
    { id: "", name: t("work_item_custom_properties.settings.applies_to_all_types") },
    ...issueTypes.map((type) => ({ id: type.id, name: type.name, logo_props: type.logo_props })),
  ];

  useEffect(() => {
    setDisplayName(propertyToUpdate?.display_name ?? "");
    setPropertyType(propertyToUpdate?.property_type ?? "TEXT");
    setIssueType(propertyToUpdate?.issue_type ?? null);
  }, [propertyToUpdate]);

  const isUpdating = !!propertyToUpdate;

  const handleSubmit = async () => {
    const trimmedName = displayName.trim();
    if (!trimmedName) return;
    setIsSubmitting(true);
    try {
      if (isUpdating)
        await operationsCallbacks.updateProperty(propertyToUpdate.id, {
          display_name: trimmedName,
          issue_type: issueType,
        });
      else
        await operationsCallbacks.createProperty({
          name: trimmedName,
          display_name: trimmedName,
          property_type: propertyType,
          issue_type: issueType,
        });
      onClose();
    } catch (error) {
      setToast({
        type: "error",
        title: t("common.error.label"),
        message:
          (error as { error?: string })?.error ??
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

  return (
    <form
      className="flex w-full items-center gap-2 rounded-sm border border-subtle bg-surface-1 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <Select<TIssueCustomPropertyType>
        getValues={() => [...ISSUE_CUSTOM_PROPERTY_TYPES]}
        value={propertyType}
        onChange={(value) => {
          if (value) setPropertyType(value as TIssueCustomPropertyType);
        }}
        getOptionValue={(type) => type}
        getOptionLabel={(type) => t(`work_item_custom_properties.types.${type.toLowerCase()}`)}
        getOptionIcon={(type) => <CustomPropertyIcon propertyType={type} className="size-3.5" />}
        showSearch={false}
        pinSelected={false}
        disabled={isUpdating}
      >
        <Select.Trigger<TIssueCustomPropertyType>
          variant="select-md"
          className="w-auto"
          disabled={isUpdating}
          prependIcon={<CustomPropertyIcon propertyType={propertyType} className="size-3.5" />}
        >
          <span className="min-w-0 grow truncate text-left">
            {t(`work_item_custom_properties.types.${propertyType.toLowerCase()}`)}
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
        disabled={!displayName.trim()}
        label={isUpdating ? t("common.update") : t("common.create")}
      />
    </form>
  );
});
