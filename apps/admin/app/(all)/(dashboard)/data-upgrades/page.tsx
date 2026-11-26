/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
// plane imports
import { setToast } from "@plane/blocks/toast";
import { hasActiveDataUpgrade, InstanceDataUpgradeService } from "@plane/services";
// components
import { PageWrapper } from "@/components/common/page-wrapper";
import { Skeleton } from "@/components/common/skeleton";
// helpers
import { getApiErrorMessage } from "@/helpers/error";
// types
import type { Route } from "./+types/page";
// local
import { DataUpgradeListItem } from "./list-item";

const dataUpgradeService = new InstanceDataUpgradeService();

const REFRESH_INTERVAL_MS = 3000;

function DataUpgradesPage(_props: Route.ComponentProps) {
  const [retrying, setRetrying] = useState<string | undefined>(undefined);

  const {
    data: upgrades,
    error,
    mutate,
  } = useSWR("INSTANCE_DATA_UPGRADES", () => dataUpgradeService.list(), {
    refreshInterval: (latest) => (hasActiveDataUpgrade(latest) ? REFRESH_INTERVAL_MS : 0),
  });

  const handleRetry = async (name: string) => {
    setRetrying(name);
    try {
      await dataUpgradeService.retry(name);
      await mutate();
      setToast({ type: "success", title: "Queued", message: `${name} runs again from the batch it failed on.` });
    } catch (retryError) {
      const message = getApiErrorMessage(retryError) ?? "The upgrade was not queued again.";
      setToast({ type: "error", title: "That did not work", message });
    } finally {
      setRetrying(undefined);
    }
  };

  return (
    <PageWrapper
      header={{
        title: "Data upgrades",
        description:
          "The worker runs these after each deploy, in this order. This page refreshes while an upgrade is pending or running.",
      }}
    >
      {upgrades === undefined ? (
        error ? (
          <p className="rounded-lg border border-subtle bg-layer-1 p-6 text-13 text-tertiary">
            {getApiErrorMessage(error) ?? "The data upgrades could not be loaded."}
          </p>
        ) : (
          <Skeleton className="space-y-4">
            <Skeleton.Item height="96px" width="100%" />
            <Skeleton.Item height="96px" width="100%" />
          </Skeleton>
        )
      ) : upgrades.length === 0 ? (
        <p className="rounded-lg border border-subtle bg-layer-1 p-6 text-13 text-tertiary">
          No data upgrades are registered.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {upgrades.map((upgrade) => (
            <DataUpgradeListItem
              key={upgrade.name}
              upgrade={upgrade}
              isRetrying={retrying === upgrade.name}
              onRetry={(name) => void handleRetry(name)}
            />
          ))}
        </div>
      )}
    </PageWrapper>
  );
}

export const meta: Route.MetaFunction = () => [{ title: "Data upgrades - God Mode" }];

export default DataUpgradesPage;
