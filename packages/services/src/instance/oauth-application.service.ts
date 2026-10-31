/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { AdminPaths } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import type { IOAuthApplication } from "@plane/types";
import type { ApiClient } from "../client";
import { createApiClient, unwrap } from "../client";

type TApplicationFields = Pick<IOAuthApplication, "name" | "redirect_uris">;

/** Errors are thrown as `ApiError`. */
export class InstanceOAuthApplicationService {
  private readonly client: ApiClient<AdminPaths>;

  constructor(BASE_URL?: string) {
    this.client = createApiClient<AdminPaths>(BASE_URL || API_BASE_URL);
  }

  async list(): Promise<IOAuthApplication[]> {
    return unwrap(this.client.GET("/api/instances/oauth-applications/"));
  }

  async create(data: TApplicationFields): Promise<IOAuthApplication> {
    return unwrap(this.client.POST("/api/instances/oauth-applications/", { body: data }));
  }

  async update(applicationId: number, data: Partial<TApplicationFields>): Promise<IOAuthApplication> {
    return unwrap(
      this.client.PATCH("/api/instances/oauth-applications/{pk}/", {
        params: { path: { pk: applicationId } },
        body: data,
      })
    );
  }

  async destroy(applicationId: number): Promise<void> {
    return unwrap(
      this.client.DELETE("/api/instances/oauth-applications/{pk}/", { params: { path: { pk: applicationId } } })
    );
  }
}
