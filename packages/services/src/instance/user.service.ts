/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { AdminPaths } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import type {
  IInstanceUserDetail,
  TInstanceUserDeactivation,
  TInstanceUserListParams,
  TInstanceUserMergeRequest,
  TInstanceUserMergeResult,
  TInstanceUserPaginationInfo,
  IInstanceUser,
} from "@plane/types";
import { APIService } from "../api.service";
import type { ApiClient } from "../client";
import { createApiClient, unwrap } from "../client";

const userPath = (pk: string) => ({ path: { pk } });

/** Methods on the typed client throw `ApiError`. */
export class InstanceUserService extends APIService {
  private readonly client: ApiClient<AdminPaths>;

  constructor(BASE_URL?: string) {
    super(BASE_URL || API_BASE_URL);
    this.client = createApiClient<AdminPaths>(BASE_URL || API_BASE_URL);
  }

  async list(params: TInstanceUserListParams = {}): Promise<TInstanceUserPaginationInfo> {
    return this.get("/api/instances/users/", { params })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async retrieve(userId: string): Promise<IInstanceUserDetail> {
    return unwrap(this.client.GET("/api/instances/users/{pk}/", { params: userPath(userId) }));
  }

  async deactivate(userId: string): Promise<TInstanceUserDeactivation> {
    return unwrap(this.client.POST("/api/instances/users/{pk}/deactivate/", { params: userPath(userId) }));
  }

  async reactivate(userId: string): Promise<{ user: IInstanceUser }> {
    return unwrap(this.client.POST("/api/instances/users/{pk}/reactivate/", { params: userPath(userId) }));
  }

  async destroy(userId: string): Promise<void> {
    return unwrap(this.client.DELETE("/api/instances/users/{pk}/", { params: userPath(userId) }));
  }

  async mergePreview(survivorId: string, data: TInstanceUserMergeRequest): Promise<TInstanceUserMergeResult> {
    return this.post(`/api/instances/users/${survivorId}/merge/preview/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async merge(survivorId: string, data: TInstanceUserMergeRequest): Promise<TInstanceUserMergeResult> {
    return this.post(`/api/instances/users/${survivorId}/merge/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
