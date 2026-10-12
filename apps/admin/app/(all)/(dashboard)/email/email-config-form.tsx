/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
// types
import { Button } from "@makeplane/propel/components/button";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import type {
  IFormattedInstanceConfiguration,
  TInstanceEmailConfigurationKeys,
  TInstanceEmailTransport,
  TInstanceMs365ConfigurationKeys,
} from "@plane/types";
// components
import type { TControllerInputFormField } from "@/components/common/controller-input";
import { ControllerInput } from "@/components/common/controller-input";
import { getMs365CredentialFields } from "@/components/common/ms365-credential-fields";
import { setToast } from "@plane/blocks/toast";
// hooks
import { useInstance } from "@/hooks/store";
// local components
import { SendTestEmailModal } from "./test-email-modal";

type IInstanceEmailForm = {
  config: IFormattedInstanceConfiguration;
};

type EmailFormValues = Record<TInstanceEmailConfigurationKeys | TInstanceMs365ConfigurationKeys, string>;

type TEmailSecurityKeys = "EMAIL_USE_TLS" | "EMAIL_USE_SSL" | "NONE";

const EMAIL_SECURITY_OPTIONS: { [key in TEmailSecurityKeys]: string } = {
  EMAIL_USE_TLS: "TLS",
  EMAIL_USE_SSL: "SSL",
  NONE: "No email security",
};

const EMAIL_TRANSPORT_OPTIONS: { [key in TInstanceEmailTransport]: string } = {
  smtp: "SMTP",
  ms365: "Microsoft 365",
};

const isEmailTransport = (value: string | null): value is TInstanceEmailTransport =>
  value !== null && value in EMAIL_TRANSPORT_OPTIONS;

export function InstanceEmailForm(props: IInstanceEmailForm) {
  const { config } = props;
  // states
  const [isSendTestEmailModalOpen, setIsSendTestEmailModalOpen] = useState(false);
  // store hooks
  const { updateInstanceConfigurations, managedConfigurationKeys } = useInstance();
  // Keys reconciled by the Helm chart are owned by the deploy and shown read-only.
  const isManaged = (key: string) => managedConfigurationKeys.has(key);
  // form data
  const {
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isValid, isDirty, isSubmitting },
  } = useForm<EmailFormValues>({
    defaultValues: {
      EMAIL_TRANSPORT: config["EMAIL_TRANSPORT"] || "smtp",
      EMAIL_HOST: config["EMAIL_HOST"],
      EMAIL_PORT: config["EMAIL_PORT"],
      EMAIL_HOST_USER: config["EMAIL_HOST_USER"],
      EMAIL_HOST_PASSWORD: config["EMAIL_HOST_PASSWORD"],
      EMAIL_USE_TLS: config["EMAIL_USE_TLS"],
      EMAIL_USE_SSL: config["EMAIL_USE_SSL"],
      EMAIL_FROM: config["EMAIL_FROM"],
      MS365_TENANT_ID: config["MS365_TENANT_ID"],
      MS365_CLIENT_ID: config["MS365_CLIENT_ID"],
      MS365_CLIENT_SECRET: config["MS365_CLIENT_SECRET"],
    },
  });
  const isMs365 = watch("EMAIL_TRANSPORT") === "ms365";

  const emailFromField: TControllerInputFormField<EmailFormValues> = {
    key: "EMAIL_FROM",
    type: "text",
    label: "Sender's email address",
    description: isMs365
      ? "The Microsoft 365 mailbox that sends the emails. Your users see this address."
      : "This is the email address your users will see when getting emails from this instance. You will need to verify this address.",
    placeholder: "no-reply@projectplane.so",
    error: Boolean(errors.EMAIL_FROM),
    required: true,
  };

  const smtpServerFields: TControllerInputFormField<EmailFormValues>[] = [
    {
      key: "EMAIL_HOST",
      type: "text",
      label: "Host",
      placeholder: "email.google.com",
      error: Boolean(errors.EMAIL_HOST),
      required: !isMs365,
    },
    {
      key: "EMAIL_PORT",
      type: "text",
      label: "Port",
      placeholder: "8080",
      error: Boolean(errors.EMAIL_PORT),
      required: !isMs365,
    },
  ];

  const smtpAuthFields: TControllerInputFormField<EmailFormValues>[] = [
    {
      key: "EMAIL_HOST_USER",
      type: "text",
      label: "Username",
      placeholder: "getitdone@projectplane.so",
      error: Boolean(errors.EMAIL_HOST_USER),
      required: false,
    },
    {
      key: "EMAIL_HOST_PASSWORD",
      type: "password",
      label: "Password",
      placeholder: "Password",
      error: Boolean(errors.EMAIL_HOST_PASSWORD),
      required: false,
    },
  ];

  const ms365Fields: TControllerInputFormField<EmailFormValues>[] = getMs365CredentialFields(errors, isMs365);

  const renderField = (field: TControllerInputFormField<EmailFormValues>) => (
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
      disabled={isManaged(field.key)}
    />
  );

  const onSubmit = async (formData: EmailFormValues) => {
    await updateInstanceConfigurations(formData)
      .then(() =>
        setToast({
          type: "success",
          title: "Success",
          message: "Email Settings updated successfully",
        })
      )
      .catch((err) => console.error(err));
  };

  const useTLSValue = watch("EMAIL_USE_TLS");
  const useSSLValue = watch("EMAIL_USE_SSL");
  const emailSecurityKey: TEmailSecurityKeys = useMemo(() => {
    if (useTLSValue === "1") return "EMAIL_USE_TLS";
    if (useSSLValue === "1") return "EMAIL_USE_SSL";
    return "NONE";
  }, [useTLSValue, useSSLValue]);

  const handleEmailSecurityChange = (key: TEmailSecurityKeys | null) => {
    if (key === "EMAIL_USE_SSL") {
      setValue("EMAIL_USE_TLS", "0", { shouldDirty: true });
      setValue("EMAIL_USE_SSL", "1", { shouldDirty: true });
    }
    if (key === "EMAIL_USE_TLS") {
      setValue("EMAIL_USE_TLS", "1", { shouldDirty: true });
      setValue("EMAIL_USE_SSL", "0", { shouldDirty: true });
    }
    if (key === "NONE") {
      setValue("EMAIL_USE_TLS", "0", { shouldDirty: true });
      setValue("EMAIL_USE_SSL", "0", { shouldDirty: true });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <SendTestEmailModal isOpen={isSendTestEmailModalOpen} handleClose={() => setIsSendTestEmailModalOpen(false)} />
        <div className="grid-col grid w-full max-w-4xl grid-cols-1 items-start justify-between gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-1">
            <h4 className="text-13 text-tertiary">Delivery method</h4>
            <Controller
              control={control}
              name="EMAIL_TRANSPORT"
              render={({ field: { value, onChange } }) => (
                <Select
                  items={EMAIL_TRANSPORT_OPTIONS}
                  value={isEmailTransport(value) ? value : "smtp"}
                  onValueChange={(transport) => {
                    if (isEmailTransport(transport)) onChange(transport);
                  }}
                  disabled={isManaged("EMAIL_TRANSPORT")}
                >
                  <SelectTrigger size="lg" placeholder="Select delivery method" />
                  <SelectContent>
                    <SelectList>
                      {Object.entries(EMAIL_TRANSPORT_OPTIONS).map(([key, label]) => (
                        <SelectItem key={key} value={key} label={label} size="lg" />
                      ))}
                    </SelectList>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {renderField(emailFromField)}
          {!isMs365 && (
            <>
              {smtpServerFields.map(renderField)}
              <div className="flex flex-col gap-1">
                <h4 className="text-13 text-tertiary">Email security</h4>
                <Select
                  items={EMAIL_SECURITY_OPTIONS}
                  value={emailSecurityKey}
                  onValueChange={handleEmailSecurityChange}
                >
                  <SelectTrigger size="lg" placeholder="Select email security" />
                  <SelectContent>
                    <SelectList>
                      {Object.entries(EMAIL_SECURITY_OPTIONS).map(([key, value]) => (
                        <SelectItem key={key} value={key} label={value} size="lg" />
                      ))}
                    </SelectList>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        <div className="my-6 flex flex-col gap-6 border-t border-subtle pt-4">
          <div className="flex w-full max-w-xl flex-col gap-y-10 px-1">
            <div className="mr-8 flex items-center gap-10 pt-4">
              <div className="grow">
                <div className="text-13 font-medium text-primary">
                  {isMs365 ? "Microsoft 365 app registration" : "Authentication"}
                </div>
                <div className="text-11 font-regular text-tertiary">
                  {isMs365
                    ? "Plane sends email through Microsoft Graph. The app registration needs the Mail.Send application permission. The service desk uses the same credentials."
                    : "This is optional, but we recommend setting up a username and a password for your SMTP server."}
                </div>
              </div>
            </div>
          </div>
          <div className="grid-col grid w-full max-w-4xl grid-cols-1 items-start justify-between gap-10 lg:grid-cols-2">
            {(isMs365 ? ms365Fields : smtpAuthFields).map(renderField)}
          </div>
        </div>
      </div>
      <div className="flex max-w-4xl items-center gap-4 py-1">
        <Button
          variant="primary"
          size="md"
          stretch="auto"
          onClick={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={!isValid || !isDirty}
          label={isSubmitting ? "Saving" : "Save changes"}
        />
        <Button
          variant="secondary"
          size="md"
          stretch="auto"
          onClick={() => setIsSendTestEmailModalOpen(true)}
          loading={isSubmitting}
          disabled={!isValid}
          label="Send test email"
        />
      </div>
    </div>
  );
}
