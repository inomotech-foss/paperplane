/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { z } from "zod";
import { unwrap } from "@plane/services";
import { apiClient } from "@/services/api-client";
import { sendJson } from "@/services/send-json";

const emailCheckSchema = z.object({
  existing: z.boolean(),
  status: z.enum(["MAGIC_CODE", "CREDENTIAL"]),
});

export type TEmailCheckResponse = z.infer<typeof emailCheckSchema>;

export const parseEmailCheck = (data: unknown): TEmailCheckResponse => emailCheckSchema.parse(data);

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class AuthService {
  async requestCSRFToken(): Promise<{ csrf_token: string }> {
    return unwrap(apiClient.GET("/auth/get-csrf-token/"));
  }

  /** The schema has no request body for this operation. */
  async emailCheck(data: { email: string }): Promise<TEmailCheckResponse> {
    return parseEmailCheck(await sendJson("/auth/spaces/email-check/", data));
  }

  /** The schema has no request body for this operation. */
  async generateUniqueCode(data: { email: string }): Promise<void> {
    await sendJson("/auth/spaces/magic-generate/", data);
  }
}
