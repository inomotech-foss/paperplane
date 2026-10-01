/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

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

export class InstanceUserService extends APIService {
  constructor(BASE_URL?: string) {
    super(BASE_URL || API_BASE_URL);
  }

  async list(params: TInstanceUserListParams = {}): Promise<TInstanceUserPaginationInfo> {
    return this.get("/api/instances/users/", { params })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async retrieve(userId: string): Promise<IInstanceUserDetail> {
    return this.get(`/api/instances/users/${userId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deactivate(userId: string): Promise<TInstanceUserDeactivation> {
    return this.post(`/api/instances/users/${userId}/deactivate/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async reactivate(userId: string): Promise<{ user: IInstanceUser }> {
    return this.post(`/api/instances/users/${userId}/reactivate/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async destroy(userId: string): Promise<void> {
    return this.delete(`/api/instances/users/${userId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
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
