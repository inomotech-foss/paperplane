/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { AdminApiSchema, AdminPaths } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import type { ApiClient } from "../client";
import { createApiClient, unwrap } from "../client";

export type TDataUpgrade = AdminApiSchema<"DataUpgrade">;
export type TDataUpgradeStatus = AdminApiSchema<"DataUpgradeStatusEnum">;

/** True while the worker still has an upgrade to run. After a failure, the pending ones wait for a retry. */
export function hasActiveDataUpgrade(upgrades: TDataUpgrade[] | undefined): boolean {
  const list = upgrades ?? [];
  if (list.some((upgrade) => upgrade.status === "running")) return true;
  return !list.some((upgrade) => upgrade.status === "failed") && list.some((upgrade) => upgrade.status === "pending");
}

/** @example formatDataUpgradeCounts({ rewritten: 274, unchanged: 80 }) // "rewritten 274, unchanged 80" */
export function formatDataUpgradeCounts(counts: TDataUpgrade["counts"]): string {
  return Object.entries(counts)
    .map(([key, value]) => `${key.replace(/_/g, " ")} ${value.toLocaleString("en-US")}`)
    .join(", ");
}

/** Errors are thrown as `ApiError`. */
export class InstanceDataUpgradeService {
  private readonly client: ApiClient<AdminPaths>;

  constructor(BASE_URL?: string) {
    this.client = createApiClient<AdminPaths>(BASE_URL || API_BASE_URL);
  }

  async list(): Promise<TDataUpgrade[]> {
    return unwrap(this.client.GET("/api/instances/data-upgrades/"));
  }

  /** Only a failed upgrade can be retried. Anything else is refused with 409. */
  async retry(name: string): Promise<TDataUpgrade> {
    return unwrap(this.client.POST("/api/instances/data-upgrades/{name}/retry/", { params: { path: { name } } }));
  }
}
