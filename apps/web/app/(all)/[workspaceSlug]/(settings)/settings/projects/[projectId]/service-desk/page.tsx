/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Avatar } from "@makeplane/propel/components/avatar";
import { Button } from "@makeplane/propel/components/button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { Switch } from "@makeplane/propel/components/switch";
import { Select } from "@plane/blocks/select";
import { Loader } from "@plane/blocks/skeleton";
import { setToast } from "@plane/blocks/toast";
import type { TServiceDeskConfig, TServiceDeskNotifyMode } from "@plane/types";
import { getFileURL, renderFormattedDate, renderFormattedTime } from "@plane/utils";
// components
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// services
import { ServiceDeskService } from "@/services/service-desk.service";
// local imports
import type { Route } from "./+types/page";
import { ServiceDeskProjectSettingsHeader } from "./header";

const serviceDeskService = new ServiceDeskService();

const NOTIFY_MODE_OPTIONS: { value: TServiceDeskNotifyMode; label: string }[] = [
  { value: "NONE", label: "Nobody" },
  { value: "ADMINS", label: "Project admins" },
  { value: "MEMBERS", label: "All members" },
  { value: "CUSTOM", label: "Specific members" },
];

function NotifyModeSelect(props: { value: TServiceDeskNotifyMode; onChange: (value: TServiceDeskNotifyMode) => void }) {
  const { value, onChange } = props;
  const selectedOption = NOTIFY_MODE_OPTIONS.find((option) => option.value === value) ?? null;
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-13 font-medium text-primary">Notify on new tickets</h4>
      <Select<(typeof NOTIFY_MODE_OPTIONS)[number]>
        getValues={() => NOTIFY_MODE_OPTIONS}
        value={selectedOption}
        onChange={(val) => {
          if (val) onChange(val as TServiceDeskNotifyMode);
        }}
        getOptionValue={(option) => option.value}
        getOptionLabel={(option) => option.label}
        showSearch={false}
        pinSelected={false}
      >
        <Select.Trigger variant="select-md" className="w-full">
          <span className="min-w-0 grow truncate text-left">{selectedOption?.label ?? "Nobody"}</span>
        </Select.Trigger>
      </Select>
    </div>
  );
}

const NotifyMembersField = observer(function NotifyMembersField(props: {
  projectId: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const { projectId, value, onChange } = props;
  const { getUserDetails } = useMember();
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-13 font-medium text-primary">Members to notify</h4>
      <div className="w-fit">
        <MemberSelect
          value={value}
          onChange={(val) => onChange(val)}
          projectId={projectId}
          multiple
          variant="select-md"
          showLabel
          placeholder="Select members"
        />
      </div>
      {value.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {value.map((userId) => {
            const memberDetails = getUserDetails(userId);
            if (!memberDetails) return null;
            return (
              <span
                key={userId}
                className="flex items-center gap-1.5 rounded-full border border-subtle px-2 py-1 text-11 text-secondary"
              >
                <Avatar
                  alt={memberDetails.display_name}
                  fallback={memberDetails.display_name?.[0]?.toUpperCase()}
                  src={getFileURL(memberDetails.avatar_url ?? "")}
                  size="xs"
                />
                {memberDetails.display_name}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
});

type TServiceDeskConfigFormProps = {
  workspaceSlug: string;
  projectId: string;
  config: TServiceDeskConfig | undefined;
  onSaved: (config: TServiceDeskConfig) => Promise<unknown>;
};

/** Holds the editable copy of the config; remounted (see `key`) whenever a new config is fetched. */
function ServiceDeskConfigForm(props: TServiceDeskConfigFormProps) {
  const { workspaceSlug, projectId, config, onSaved } = props;
  // states
  const [mailboxEmail, setMailboxEmail] = useState(config?.mailbox_email ?? "");
  const [isEnabled, setIsEnabled] = useState(!!config?.is_enabled);
  const [notifyMode, setNotifyMode] = useState<TServiceDeskNotifyMode>(config?.notify_mode ?? "NONE");
  const [notifyUserIds, setNotifyUserIds] = useState<string[]>(config?.notify_user_ids ?? []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const response = await serviceDeskService.updateConfig(workspaceSlug, projectId, {
        mailbox_email: mailboxEmail.trim(),
        is_enabled: isEnabled,
        notify_mode: notifyMode,
        notify_user_ids: notifyMode === "CUSTOM" ? notifyUserIds : [],
      });
      await onSaved(response);
      setToast({
        type: "success",
        title: "Success!",
        message: "Service desk settings saved successfully.",
      });
    } catch (err) {
      setToast({
        type: "error",
        title: "Error!",
        message:
          (err as { error?: string } | undefined)?.error ?? "Failed to save service desk settings. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-6 flex w-full max-w-lg flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h4 className="text-13 font-medium text-primary">Mailbox email</h4>
        <InputGroup size="md">
          <Input
            id="service-desk-mailbox-email"
            type="email"
            size="md"
            aria-label="Mailbox email"
            value={mailboxEmail}
            onChange={(e) => setMailboxEmail(e.target.value)}
            placeholder="support@yourcompany.com"
            autoComplete="off"
          />
        </InputGroup>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h4 className="text-13 font-medium text-primary">Poll this mailbox and create intake work items</h4>
          <p className="text-body-xs-regular text-tertiary">
            Enabling this also turns on the project&apos;s Intake feature.
          </p>
        </div>
        <Switch
          size="sm"
          checked={isEnabled}
          onCheckedChange={setIsEnabled}
          aria-label="Poll this mailbox and create intake work items"
        />
      </div>
      <div className="flex flex-col gap-4 border-t border-subtle pt-6">
        <h4 className="text-h6-medium text-primary">Notifications</h4>
        <NotifyModeSelect value={notifyMode} onChange={setNotifyMode} />
        {notifyMode === "CUSTOM" && (
          <NotifyMembersField projectId={projectId} value={notifyUserIds} onChange={setNotifyUserIds} />
        )}
        <p className="text-body-xs-regular text-tertiary">
          Selected members get an in-app notification for every new ticket and are subscribed to its updates.
        </p>
      </div>
      {config?.last_synced_at && (
        <p className="text-body-xs-regular text-tertiary">
          Last synced {renderFormattedDate(config.last_synced_at)} at {renderFormattedTime(config.last_synced_at)}
        </p>
      )}
      <div>
        <Button
          variant="primary"
          size="md"
          onClick={() => void handleSave()}
          loading={isSubmitting}
          disabled={isSubmitting}
          stretch="auto"
          label={isSubmitting ? "Saving..." : "Save changes"}
        />
      </div>
    </div>
  );
}

function ServiceDeskSettingsPage({ params }: Route.ComponentProps) {
  // router
  const { workspaceSlug, projectId } = params;
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

  if (workspaceUserInfo && !canPerformProjectAdminActions) {
    return <NotAuthorizedView section="settings" isProjectView className="h-auto" />;
  }

  const showLoader = isLoading && !config && !error;

  return (
    <SettingsContentWrapper header={<ServiceDeskProjectSettingsHeader />}>
      <PageHead title={pageTitle} />
      <section className="w-full">
        <SettingsHeading
          title="Service Desk — Create tickets from a Microsoft 365 mailbox"
          description="Unread emails in this mailbox create work items in the project's Intake. The Microsoft 365 app credentials are configured at the instance level (SERVICE_DESK_MS365_TENANT_ID / _CLIENT_ID / _CLIENT_SECRET)."
        />
        {showLoader ? (
          <Loader className="mt-6 space-y-4">
            <Loader.Item height="40px" />
            <Loader.Item height="24px" width="60%" />
            <Loader.Item height="32px" width="120px" />
          </Loader>
        ) : (
          <ServiceDeskConfigForm
            key={config?.updated_at ?? "new"}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            config={config}
            onSaved={(response) => mutate(response, { revalidate: false })}
          />
        )}
      </section>
    </SettingsContentWrapper>
  );
}

export default observer(ServiceDeskSettingsPage);
