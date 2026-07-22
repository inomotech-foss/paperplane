/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Input, Loader, ToggleSwitch } from "@plane/ui";
import { renderFormattedDate, renderFormattedTime } from "@plane/utils";
// components
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// services
import { ServiceDeskService } from "@/services/service-desk.service";
// local imports
import type { Route } from "./+types/page";
import { ServiceDeskProjectSettingsHeader } from "./header";

const serviceDeskService = new ServiceDeskService();

function ServiceDeskSettingsPage({ params }: Route.ComponentProps) {
  // router
  const { workspaceSlug, projectId } = params;
  // states
  const [mailboxEmail, setMailboxEmail] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // store hooks
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { currentProjectDetails } = useProject();
  // derived values
  const canPerformProjectAdminActions = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT);
  const pageTitle = currentProjectDetails?.name ? `${currentProjectDetails?.name} - Service Desk` : undefined;

  // fetch the existing config. A 404 means the service desk is not configured
  // yet — surface the empty form instead of an error, hence no retries.
  const {
    data: config,
    error,
    isLoading,
    mutate,
  } = useSWR(
    workspaceSlug && projectId ? `SERVICE_DESK_CONFIG_${workspaceSlug}_${projectId}` : null,
    workspaceSlug && projectId ? () => serviceDeskService.getConfig(workspaceSlug, projectId) : null,
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  // sync form state with the fetched config
  useEffect(() => {
    if (!config) return;
    setMailboxEmail(config.mailbox_email ?? "");
    setIsEnabled(!!config.is_enabled);
  }, [config]);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const response = await serviceDeskService.updateConfig(workspaceSlug, projectId, {
        mailbox_email: mailboxEmail.trim(),
        is_enabled: isEnabled,
      });
      await mutate(response, { revalidate: false });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success!",
        message: "Service desk settings saved successfully.",
      });
    } catch (err) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message:
          (err as { error?: string } | undefined)?.error ?? "Failed to save service desk settings. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (workspaceUserInfo && !canPerformProjectAdminActions) {
    return <NotAuthorizedView section="settings" isProjectView className="h-auto" />;
  }

  return (
    <SettingsContentWrapper header={<ServiceDeskProjectSettingsHeader />}>
      <PageHead title={pageTitle} />
      <section className="w-full">
        <SettingsHeading
          title="Service Desk — Create tickets from a Microsoft 365 mailbox"
          description="Unread emails in this mailbox create work items in the project's Intake. The Microsoft 365 app credentials are configured at the instance level (SERVICE_DESK_MS365_TENANT_ID / _CLIENT_ID / _CLIENT_SECRET)."
        />
        {isLoading && !config && !error ? (
          <Loader className="mt-6 space-y-4">
            <Loader.Item height="40px" />
            <Loader.Item height="24px" width="60%" />
            <Loader.Item height="32px" width="120px" />
          </Loader>
        ) : (
          <div className="mt-6 flex w-full max-w-lg flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <h4 className="text-13 font-medium text-primary">Mailbox email</h4>
              <Input
                id="service-desk-mailbox-email"
                type="email"
                className="w-full"
                value={mailboxEmail}
                onChange={(e) => setMailboxEmail(e.target.value)}
                placeholder="support@yourcompany.com"
                autoComplete="off"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <h4 className="text-13 font-medium text-primary">Poll this mailbox and create intake work items</h4>
                <p className="text-body-xs-regular text-tertiary">
                  Enabling this also turns on the project&apos;s Intake feature.
                </p>
              </div>
              <ToggleSwitch value={isEnabled} onChange={() => setIsEnabled((prev) => !prev)} size="sm" />
            </div>
            {config?.last_synced_at && (
              <p className="text-body-xs-regular text-tertiary">
                Last synced {renderFormattedDate(config.last_synced_at)} at {renderFormattedTime(config.last_synced_at)}
              </p>
            )}
            <div>
              <Button variant="primary" size="lg" onClick={handleSave} loading={isSubmitting} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </div>
        )}
      </section>
    </SettingsContentWrapper>
  );
}

export default observer(ServiceDeskSettingsPage);
