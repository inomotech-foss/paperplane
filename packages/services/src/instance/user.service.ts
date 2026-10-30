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
import type { ApiClient } from "../client";
import { createApiClient, unwrap } from "../client";

const userPath = (pk: string) => ({ path: { pk } });

const flag = (value: boolean | undefined) => (value === undefined ? undefined : value ? "true" : "false");

/** Errors are thrown as `ApiError`. */
export class InstanceUserService {
  private readonly client: ApiClient<AdminPaths>;

  constructor(BASE_URL?: string) {
    this.client = createApiClient<AdminPaths>(BASE_URL || API_BASE_URL);
  }

  async list(params: TInstanceUserListParams = {}): Promise<TInstanceUserPaginationInfo> {
    return unwrap(
      this.client.GET("/api/instances/users/", {
        params: {
          query: {
            search: params.search,
            is_active: flag(params.is_active),
            is_bot: flag(params.is_bot),
            include_deleted: flag(params.include_deleted),
            cursor: params.cursor,
          },
        },
      })
    );
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
    return unwrap(
      this.client.POST("/api/instances/users/{pk}/merge/preview/", { params: userPath(survivorId), body: data })
    );
  }

  async merge(survivorId: string, data: TInstanceUserMergeRequest): Promise<TInstanceUserMergeResult> {
    return unwrap(this.client.POST("/api/instances/users/{pk}/merge/", { params: userPath(survivorId), body: data }));
  }
}
