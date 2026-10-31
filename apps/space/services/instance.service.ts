/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { AdminApiResponse } from "@plane/api-types";
import { unwrap } from "@plane/services";
import { adminApiClient } from "@/services/api-client";

/** The instance info, or only its activation flags while the instance is not registered. */
export type TInstanceInfoResponse = AdminApiResponse<"/api/instances/", "get">;

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class InstanceService {
  async info(): Promise<TInstanceInfoResponse> {
    return unwrap(adminApiClient.GET("/api/instances/"));
  }
}
