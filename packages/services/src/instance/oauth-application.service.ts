/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { IOAuthApplication } from "@plane/types";
import { APIService } from "../api.service";

export class InstanceOAuthApplicationService extends APIService {
  constructor(BASE_URL?: string) {
    super(BASE_URL || API_BASE_URL);
  }

  async list(): Promise<IOAuthApplication[]> {
    return this.get("/api/instances/oauth-applications/")
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * The response carries client_secret, which is hashed on save and cannot be
   * read back afterwards.
   */
  async create(data: Pick<IOAuthApplication, "name" | "redirect_uris">): Promise<IOAuthApplication> {
    return this.post("/api/instances/oauth-applications/", data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async update(
    applicationId: number,
    data: Partial<Pick<IOAuthApplication, "name" | "redirect_uris">>
  ): Promise<IOAuthApplication> {
    return this.patch(`/api/instances/oauth-applications/${applicationId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async destroy(applicationId: number): Promise<void> {
    return this.delete(`/api/instances/oauth-applications/${applicationId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
