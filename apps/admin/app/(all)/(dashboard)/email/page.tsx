/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { Switch } from "@makeplane/propel/components/switch";
import type { IFormattedInstanceConfiguration } from "@plane/types";
// components
import { PageWrapper } from "@/components/common/page-wrapper";
import { Skeleton } from "@/components/common/skeleton";
import { setToast } from "@plane/blocks/toast";
// hooks
import { useInstance } from "@/hooks/store";
// types
import type { Route } from "./+types/page";
// local
import { InstanceEmailForm } from "./email-config-form";

const isEmailConfigured = (config: IFormattedInstanceConfiguration) =>
  config.EMAIL_TRANSPORT === "ms365"
    ? Boolean(config.EMAIL_FROM && config.MS365_TENANT_ID && config.MS365_CLIENT_ID && config.MS365_CLIENT_SECRET)
    : Boolean(config.EMAIL_HOST);

const InstanceEmailPage = observer(function InstanceEmailPage(_props: Route.ComponentProps) {
  // store
  const { fetchInstanceConfigurations, formattedConfig, disableEmail, managedConfigurationKeys } = useInstance();

  const { isLoading } = useSWR("INSTANCE_CONFIGURATIONS", () => fetchInstanceConfigurations());

  const [isSubmitting, setIsSubmitting] = useState(false);
  // The form stays open after switching on, before anything is saved.
  const [isFormOpen, setIsFormOpen] = useState(false);
  const isEmailEnabled = isFormOpen || (formattedConfig ? isEmailConfigured(formattedConfig) : false);

  const handleToggle = async () => {
    if (isEmailEnabled) {
      setIsSubmitting(true);
      try {
        await disableEmail();
        setIsFormOpen(false);
        setToast({
          title: "Email feature disabled",
          message: "Email feature has been disabled",
          type: "success",
        });
      } catch (_error) {
        setToast({
          title: "Error disabling email",
          message: "Failed to disable email feature. Please try again.",
          type: "error",
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    setIsFormOpen(true);
  };

  return (
    <PageWrapper
      header={{
        title: "Secure emails from your own instance",
        description: (
          <>
            Plane can send useful emails to you and your users through your own SMTP server or Microsoft 365.
            <div className="text-13 font-regular text-tertiary">
              Set it up below and please test your settings before you save them.&nbsp;
              <span className="text-danger-primary">Misconfigs can lead to email bounces and errors.</span>
            </div>
          </>
        ),
        actions: isLoading ? (
          <Skeleton>
            <Skeleton.Item width="24px" height="16px" className="rounded-full" />
          </Skeleton>
        ) : (
          <Switch
            aria-label="Enable email"
            checked={isEmailEnabled}
            onCheckedChange={handleToggle}
            size="sm"
            disabled={isSubmitting || managedConfigurationKeys.has("EMAIL_TRANSPORT")}
          />
        ),
      }}
    >
      {isEmailEnabled && !isLoading && (
        <>
          {formattedConfig ? (
            <InstanceEmailForm config={formattedConfig} />
          ) : (
            <Skeleton className="space-y-10">
              <Skeleton.Item height="50px" width="75%" />
              <Skeleton.Item height="50px" width="75%" />
              <Skeleton.Item height="50px" width="40%" />
              <Skeleton.Item height="50px" width="40%" />
              <Skeleton.Item height="50px" width="20%" />
            </Skeleton>
          )}
        </>
      )}
    </PageWrapper>
  );
});

export const meta: Route.MetaFunction = () => [{ title: "Email Settings - God Mode" }];

export default InstanceEmailPage;
