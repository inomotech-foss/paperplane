/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type React from "react";
import Link from "next/link";
import type { Control, FieldValues } from "react-hook-form";
import { MonitorOutline } from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { cn } from "@plane/utils";
// components
import type { TControllerInputFormField } from "@/components/common/controller-input";
import { ControllerInput } from "@/components/common/controller-input";
import type { TControllerSwitchFormField } from "@/components/common/controller-switch";
import { ControllerSwitch } from "@/components/common/controller-switch";
import type { TCopyField } from "@/components/common/copy-field";
import { CopyField } from "@/components/common/copy-field";

type TProviderFormActionsProps = {
  isDirty: boolean;
  isSubmitting: boolean;
  onGoBack: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  onSave: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

export function ProviderFormActions(props: TProviderFormActionsProps) {
  const { isDirty, isSubmitting, onGoBack, onSave } = props;
  return (
    <div className="flex flex-col gap-1 pt-4">
      <div className="flex items-center gap-4">
        <Button
          variant="primary"
          size="md"
          stretch="auto"
          onClick={onSave}
          loading={isSubmitting}
          disabled={!isDirty}
          label={isSubmitting ? "Saving" : "Save changes"}
        />
        <Button
          variant="secondary"
          size="md"
          stretch="auto"
          nativeButton={false}
          render={<Link href="/authentication" onClick={onGoBack} />}
          label="Go back"
        />
      </div>
    </div>
  );
}

type TProviderServiceDetailsProps = {
  title: string;
  fields: TCopyField[];
  className?: string;
};

/** A single card of Plane-provided details, e.g. the callback URI. */
export function ProviderServiceDetails(props: TProviderServiceDetailsProps) {
  const { title, fields, className = "bg-layer-1" } = props;
  return (
    <div className="col-span-2 md:col-span-1">
      <div className={cn("flex flex-col gap-y-4 rounded-lg px-6 pt-1.5 pb-4", className)}>
        <div className="pt-2 text-18 font-medium">{title}</div>
        {fields.map((field) => (
          <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
        ))}
      </div>
    </div>
  );
}

type TProviderWebServiceDetailsProps = {
  title: string;
  commonFields: TCopyField[];
  webFields: TCopyField[];
};

/** Plane-provided details split into common fields and a "Web" section. */
export function ProviderWebServiceDetails(props: TProviderWebServiceDetailsProps) {
  const { title, commonFields, webFields } = props;
  return (
    <div className="col-span-2 flex flex-col gap-y-6 md:col-span-1">
      <div className="pt-2 text-18 font-medium">{title}</div>

      <div className="flex flex-col gap-y-4">
        {/* common service details */}
        <div className="flex flex-col gap-y-4 rounded-lg bg-layer-1 px-6 py-4">
          {commonFields.map((field) => (
            <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
          ))}
        </div>

        {/* web service details */}
        <div className="flex flex-col overflow-hidden rounded-lg">
          <div className="flex items-center gap-x-3 bg-layer-3 px-6 py-3 text-11 font-medium text-secondary uppercase">
            <MonitorOutline className="h-3 w-3" />
            Web
          </div>
          <div className="flex flex-col gap-y-4 bg-layer-1 px-6 py-4">
            {webFields.map((field) => (
              <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type TProviderConfigFormLayoutProps<T extends FieldValues> = TProviderFormActionsProps & {
  title: string;
  control: Control<T>;
  fields: TControllerInputFormField<T>[];
  switchField: TControllerSwitchFormField<T>;
  /** Right-hand column, usually `ProviderServiceDetails` or `ProviderWebServiceDetails`. */
  serviceDetails: React.ReactNode;
};

/** Two-column layout shared by the OAuth provider config forms. */
export function ProviderConfigFormLayout<T extends FieldValues>(props: TProviderConfigFormLayoutProps<T>) {
  const { title, control, fields, switchField, serviceDetails, ...actionProps } = props;
  return (
    <div className="flex flex-col gap-8">
      <div className="grid w-full grid-cols-2 gap-x-12 gap-y-8">
        <div className="col-span-2 flex flex-col gap-y-4 pt-1 md:col-span-1">
          <div className="pt-2.5 text-18 font-medium">{title}</div>
          {fields.map((field) => (
            <ControllerInput
              key={field.key}
              control={control}
              type={field.type}
              name={field.key}
              label={field.label}
              description={field.description}
              placeholder={field.placeholder}
              error={field.error}
              required={field.required}
            />
          ))}
          <ControllerSwitch control={control} field={switchField} />
          <ProviderFormActions {...actionProps} />
        </div>
        {serviceDetails}
      </div>
    </div>
  );
}
