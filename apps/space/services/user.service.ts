/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiResponse } from "@plane/api-types";
import { unwrap } from "@plane/services";
import { apiClient } from "@/services/api-client";

export type TCurrentUser = ApiResponse<"/api/users/me/", "get">;
export type TUserProfile = ApiResponse<"/api/users/me/profile/", "get">;

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class UserService {
  async me(): Promise<TCurrentUser> {
    return unwrap(apiClient.GET("/api/users/me/"));
  }

  async profile(): Promise<TUserProfile> {
    return unwrap(apiClient.GET("/api/users/me/profile/"));
  }
}
