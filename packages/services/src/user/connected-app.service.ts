/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { IConnectedApp } from "@plane/types";
import { APIService } from "../api.service";

export class ConnectedAppService extends APIService {
  constructor(BASE_URL?: string) {
    super(BASE_URL || API_BASE_URL);
  }

  async list(): Promise<IConnectedApp[]> {
    return this.get("/api/users/connected-apps/")
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /** Drops the grant and retires the credentials issued against it. */
  async revoke(applicationId: number): Promise<void> {
    return this.delete(`/api/users/connected-apps/${applicationId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
