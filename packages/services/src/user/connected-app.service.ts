/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { InternalPaths } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import type { IConnectedApp } from "@plane/types";
import type { ApiClient } from "../client";
import { createApiClient, unwrap } from "../client";

/** Errors are thrown as `ApiError`. */
export class ConnectedAppService {
  private readonly client: ApiClient<InternalPaths>;

  constructor(BASE_URL?: string) {
    this.client = createApiClient<InternalPaths>(BASE_URL || API_BASE_URL);
  }

  async list(): Promise<IConnectedApp[]> {
    return unwrap(this.client.GET("/api/users/connected-apps/"));
  }

  /** Drops the grant and retires the credentials issued against it. */
  async revoke(applicationId: number): Promise<void> {
    return unwrap(this.client.DELETE("/api/users/connected-apps/{pk}/", { params: { path: { pk: applicationId } } }));
  }
}
