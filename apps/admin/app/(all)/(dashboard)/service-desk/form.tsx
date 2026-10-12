/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useForm } from "react-hook-form";
import { Lightbulb } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import type {
  IFormattedInstanceConfiguration,
  TInstanceMs365ConfigurationKeys,
  TInstanceServiceDeskConfigurationKeys,
} from "@plane/types";
// components
import type { TControllerInputFormField } from "@/components/common/controller-input";
import { ControllerInput } from "@/components/common/controller-input";
import { getMs365CredentialFields } from "@/components/common/ms365-credential-fields";
// hooks
import { useInstance } from "@/hooks/store";

type IInstanceServiceDeskForm = {
  config: IFormattedInstanceConfiguration;
};

type ServiceDeskFormValues = Record<TInstanceServiceDeskConfigurationKeys | TInstanceMs365ConfigurationKeys, string>;

export function InstanceServiceDeskForm(props: IInstanceServiceDeskForm) {
  const { config } = props;
  // store
  const { updateInstanceConfigurations, managedConfigurationKeys } = useInstance();
  // form data
  const {
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ServiceDeskFormValues>({
    defaultValues: {
      MS365_TENANT_ID: config["MS365_TENANT_ID"],
      MS365_CLIENT_ID: config["MS365_CLIENT_ID"],
      MS365_CLIENT_SECRET: config["MS365_CLIENT_SECRET"],
      SERVICE_DESK_WEBHOOK_URL: config["SERVICE_DESK_WEBHOOK_URL"],
    },
  });

  const serviceDeskFormFields: TControllerInputFormField<ServiceDeskFormValues>[] = [
    ...getMs365CredentialFields(errors, false),
    {
      key: "SERVICE_DESK_WEBHOOK_URL",
      type: "text",
      label: "Webhook URL",
      description:
        "Optional. Public URL Microsoft Graph pushes new-mail notifications to. Leave empty to derive it from your web URL as WEB_URL/api/service-desk/webhook/ (HTTPS only).",
      placeholder: "https://plane.example.com/api/service-desk/webhook/",
      error: Boolean(errors.SERVICE_DESK_WEBHOOK_URL),
      required: false,
    },
  ];

  const onSubmit = async (formData: ServiceDeskFormValues) => {
    const payload: Partial<ServiceDeskFormValues> = { ...formData };

    await updateInstanceConfigurations(payload)
      .then(() =>
        setToast({
          type: "success",
          title: "Success",
          message: "Service Desk settings updated successfully",
        })
      )
      .catch((err) => console.error(err));
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div>
          <div className="pb-1 text-18 font-medium text-primary">Microsoft 365</div>
          <div className="text-13 font-regular text-tertiary">
            Credentials of the app registration Plane uses to read the service desk mailboxes. Outgoing email through
            Microsoft 365 uses the same credentials.
          </div>
        </div>
        <div className="grid-col grid w-full max-w-4xl grid-cols-1 items-start justify-between gap-x-12 gap-y-8 lg:grid-cols-2">
          {serviceDeskFormFields.map((field) => (
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
              disabled={managedConfigurationKeys.has(field.key)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col items-start gap-4">
        <Button
          variant="primary"
          size="md"
          stretch="auto"
          onClick={handleSubmit(onSubmit)}
          loading={isSubmitting}
          label={isSubmitting ? "Saving" : "Save changes"}
        />

        <div className="relative inline-flex items-center gap-1.5 rounded-sm border border-accent-subtle bg-accent-subtle px-4 py-2 text-caption-sm-regular text-accent-secondary">
          <Lightbulb className="size-4 shrink-0" />
          <div>
            Per-project mailboxes are configured in each project&apos;s settings. The webhook URL must be reachable from
            Microsoft&apos;s cloud over HTTPS — without a public HTTPS URL, mail is picked up by polling only.
          </div>
        </div>
      </div>
    </div>
  );
}
