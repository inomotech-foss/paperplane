/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import { apiClient } from "@/services/api-client";

export type TEmailCheckResponse = ApiSchema<"EmailCheck">;

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class AuthService {
  async requestCSRFToken(): Promise<{ csrf_token: string }> {
    return unwrap(apiClient.GET("/auth/get-csrf-token/"));
  }

  async emailCheck(data: { email: string }): Promise<TEmailCheckResponse> {
    return unwrap(apiClient.POST("/auth/spaces/email-check/", { body: data }));
  }

  async generateUniqueCode(data: { email: string }): Promise<void> {
    await unwrap(apiClient.POST("/auth/spaces/magic-generate/", { body: data }));
  }
}
