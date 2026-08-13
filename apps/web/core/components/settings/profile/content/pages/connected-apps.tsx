/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { CONNECTED_APPS_LIST } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { ConnectedAppService } from "@plane/services";
import type { IConnectedApp } from "@plane/types";
import { AlertModalCore } from "@plane/ui";
// components
import { ProfileSettingsHeading } from "@/components/settings/profile/heading";
import { APITokenSettingsLoader } from "@/components/ui/loader/settings/api-token";
// local imports
import { ConnectedAppListItem } from "./connected-app-list-item";

const connectedAppService = new ConnectedAppService();

export const ConnectedAppsProfileSettings = observer(function ConnectedAppsProfileSettings() {
  // states
  const [revoking, setRevoking] = useState<IConnectedApp | undefined>(undefined);
  const [isRevoking, setIsRevoking] = useState(false);
  // data
  const { data: apps, mutate } = useSWR(CONNECTED_APPS_LIST, () => connectedAppService.list());
  // translation
  const { t } = useTranslation();

  if (!apps) {
    return <APITokenSettingsLoader />;
  }

  const handleRevoke = async () => {
    if (!revoking) return;
    setIsRevoking(true);
    try {
      await connectedAppService.revoke(revoking.id);
      await mutate();
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("success"),
        message: t("account_settings.connected_apps.revoked", { name: revoking.name }),
      });
      setRevoking(undefined);
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("error"),
        message: t("account_settings.connected_apps.revoke_failed"),
      });
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="size-full">
      <ProfileSettingsHeading
        title={t("account_settings.connected_apps.title")}
        description={t("account_settings.connected_apps.description")}
      />
      <div className="mt-7">
        {apps.length > 0 ? (
          <div>
            {apps.map((app) => (
              <ConnectedAppListItem key={app.id} app={app} onRevoke={setRevoking} />
            ))}
          </div>
        ) : (
          <EmptyStateCompact
            assetKey="token"
            assetClassName="size-20"
            title={t("account_settings.connected_apps.empty_title")}
            description={t("account_settings.connected_apps.empty_description")}
            align="start"
            rootClassName="py-20"
          />
        )}
      </div>
      <AlertModalCore
        isOpen={Boolean(revoking)}
        handleClose={() => setRevoking(undefined)}
        handleSubmit={handleRevoke}
        isSubmitting={isRevoking}
        primaryButtonText={{
          default: t("account_settings.connected_apps.revoke"),
          loading: t("account_settings.connected_apps.revoking"),
        }}
        title={t("account_settings.connected_apps.revoke_title", { name: revoking?.name ?? "" })}
        content={t("account_settings.connected_apps.revoke_description")}
      />
    </div>
  );
});
