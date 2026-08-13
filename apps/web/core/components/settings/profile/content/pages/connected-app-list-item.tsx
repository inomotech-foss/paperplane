/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { XCircle } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@plane/propel/tooltip";
import type { IConnectedApp } from "@plane/types";
import { renderFormattedDate } from "@plane/utils";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";

type Props = {
  app: IConnectedApp;
  onRevoke: (app: IConnectedApp) => void;
};

export function ConnectedAppListItem(props: Props) {
  const { app, onRevoke } = props;
  const { isMobile } = usePlatformOS();
  const { t } = useTranslation();

  return (
    <div className="group relative flex flex-col justify-center border-b border-subtle py-3">
      <Tooltip tooltipContent={t("account_settings.connected_apps.revoke")} isMobile={isMobile}>
        <button
          onClick={() => onRevoke(app)}
          // Fades in on hover rather than unmounting, so it stays reachable by keyboard.
          className="absolute right-4 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          aria-label={t("account_settings.connected_apps.revoke")}
        >
          <XCircle className="h-4 w-4 text-danger-primary" />
        </button>
      </Tooltip>
      <h5 className="w-4/5 truncate text-13 font-medium">{app.name}</h5>
      <p className="mt-1 text-13 text-secondary">{app.workspaces.map((workspace) => workspace.name).join(", ")}</p>
      <p className="mb-1 text-11 leading-6 text-placeholder">
        {t("account_settings.connected_apps.connected_on", { date: renderFormattedDate(app.connected_at) })}
      </p>
    </div>
  );
}
