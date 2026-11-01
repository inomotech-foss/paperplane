/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { AdminPaths } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import type {
  IFormattedInstanceConfiguration,
  IInstance,
  IInstanceAdmin,
  IInstanceConfiguration,
  IInstanceInfo,
} from "@plane/types";
import type { ApiClient } from "../client";
import { createApiClient, unwrap } from "../client";
import { toInstance, toInstanceConfiguration, toInstanceInfo } from "./instance-convert";
import type { TUnregisteredInstance } from "./instance-convert";

type TInstanceUpdate = Partial<Pick<IInstance, "instance_name" | "is_telemetry_enabled" | "is_support_required">>;

/** Errors are thrown as `ApiError`. */
export class InstanceService {
  private readonly client: ApiClient<AdminPaths>;

  constructor(BASE_URL?: string) {
    this.client = createApiClient<AdminPaths>(BASE_URL || API_BASE_URL);
  }

  async info(): Promise<IInstanceInfo | TUnregisteredInstance> {
    return toInstanceInfo(await unwrap(this.client.GET("/api/instances/")));
  }

  async admins(): Promise<IInstanceAdmin[]> {
    return unwrap(this.client.GET("/api/instances/admins/"));
  }

  async update(data: TInstanceUpdate): Promise<IInstance> {
    return toInstance(await unwrap(this.client.PATCH("/api/instances/", { body: data })));
  }

  async configurations(): Promise<IInstanceConfiguration[]> {
    const rows = await unwrap(this.client.GET("/api/instances/configurations/"));
    return rows.map(toInstanceConfiguration);
  }

  async updateConfigurations(data: Partial<IFormattedInstanceConfiguration>): Promise<IInstanceConfiguration[]> {
    const body: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) if (value !== undefined) body[key] = value;
    const rows = await unwrap(this.client.PATCH("/api/instances/configurations/", { body }));
    return rows.map(toInstanceConfiguration);
  }

  async sendTestEmail(receiverEmail: string): Promise<void> {
    await unwrap(
      this.client.POST("/api/instances/email-credentials-check/", { body: { receiver_email: receiverEmail } })
    );
  }

  async disableEmail(): Promise<void> {
    await unwrap(this.client.DELETE("/api/instances/configurations/disable-email-feature/"));
  }
}
