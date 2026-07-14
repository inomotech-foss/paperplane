/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useForm } from "react-hook-form";
// plane internal packages
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IFormattedInstanceConfiguration, TInstanceRateLimitConfigurationKeys } from "@plane/types";
// components
import type { TControllerInputFormField } from "@/components/common/controller-input";
import { ControllerInput } from "@/components/common/controller-input";
// hooks
import { useInstance } from "@/hooks/store";

type Props = {
  config: IFormattedInstanceConfiguration;
};

type RateLimitFormValues = Record<TInstanceRateLimitConfigurationKeys, string>;

// DRF rate format: "<count>/<period>", period one of second/minute/hour/day.
const RATE_PATTERN = /^\d+\/(second|minute|hour|day)$/;

export function InstanceRateLimitForm(props: Props) {
  const { config } = props;
  // store hooks
  const { updateInstanceConfigurations, managedConfigurationKeys } = useInstance();
  // Keys reconciled by the Helm chart are owned by the deploy and shown read-only.
  const isManaged = (key: string) => managedConfigurationKeys.has(key);
  const hasManagedFields = managedConfigurationKeys.size > 0;
  // form data
  const {
    handleSubmit,
    control,
    setError,
    clearErrors,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<RateLimitFormValues>({
    defaultValues: {
      API_KEY_RATE_LIMIT: config["API_KEY_RATE_LIMIT"] || "60/minute",
      ANON_RATE_LIMIT: config["ANON_RATE_LIMIT"] || "30/minute",
      ASSET_RATE_LIMIT: config["ASSET_RATE_LIMIT"] || "5/minute",
      AUTHENTICATION_RATE_LIMIT: config["AUTHENTICATION_RATE_LIMIT"] || "10/minute",
    },
  });

  const rateLimitFormFields: TControllerInputFormField[] = [
    {
      key: "API_KEY_RATE_LIMIT",
      type: "text",
      label: "API token requests",
      description: "Limit per API token on the external REST API.",
      placeholder: "60/minute",
      error: Boolean(errors.API_KEY_RATE_LIMIT),
      required: true,
    },
    {
      key: "ANON_RATE_LIMIT",
      type: "text",
      label: "Anonymous requests",
      description: "Limit per client for unauthenticated requests.",
      placeholder: "30/minute",
      error: Boolean(errors.ANON_RATE_LIMIT),
      required: true,
    },
    {
      key: "ASSET_RATE_LIMIT",
      type: "text",
      label: "Asset requests",
      description: "Limit per asset for upload and download requests.",
      placeholder: "5/minute",
      error: Boolean(errors.ASSET_RATE_LIMIT),
      required: true,
    },
    {
      key: "AUTHENTICATION_RATE_LIMIT",
      type: "text",
      label: "Authentication requests",
      description: "Limit per client for sign-in, sign-up, and magic-code requests.",
      placeholder: "10/minute",
      error: Boolean(errors.AUTHENTICATION_RATE_LIMIT),
      required: true,
    },
  ];

  const onSubmit = async (formData: RateLimitFormValues) => {
    clearErrors();
    const payload: Partial<RateLimitFormValues> = {};
    let hasInvalid = false;
    for (const field of rateLimitFormFields) {
      const key = field.key as TInstanceRateLimitConfigurationKeys;
      const value = formData[key].trim();
      if (!RATE_PATTERN.test(value)) {
        setError(key, { message: "Use the format count/period, e.g. 60/minute." });
        hasInvalid = true;
        continue;
      }
      if (!isManaged(key)) payload[key] = value;
    }
    if (hasInvalid) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Invalid rate limit",
        message: "Enter each limit as count/period, e.g. 60/minute.",
      });
      return;
    }

    await updateInstanceConfigurations(payload)
      .then(() =>
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "Success",
          message: "Rate limits updated successfully. Changes apply within a few seconds.",
        })
      )
      .catch((err) => console.error(err));
  };

  return (
    <div className="space-y-8">
      {hasManagedFields && (
        <p className="max-w-4xl text-13 text-tertiary">
          Some fields are managed by the Helm chart and are read-only here. Edit them in your chart values.
        </p>
      )}
      <div className="grid w-full max-w-4xl grid-cols-1 items-start justify-between gap-10 lg:grid-cols-2">
        {rateLimitFormFields.map((field) => (
          <ControllerInput
            key={field.key}
            control={control}
            type={field.type}
            name={field.key}
            label={field.label}
            description={errors[field.key as TInstanceRateLimitConfigurationKeys]?.message ?? field.description}
            placeholder={field.placeholder}
            error={field.error}
            required={field.required}
            disabled={isManaged(field.key)}
          />
        ))}
      </div>
      <div className="flex max-w-4xl items-center py-1">
        <Button variant="primary" size="lg" onClick={handleSubmit(onSubmit)} loading={isSubmitting} disabled={!isDirty}>
          {isSubmitting ? "Saving" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
