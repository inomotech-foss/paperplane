/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { toInstanceInfo, unwrap } from "@plane/services";
import type { TUnregisteredInstance } from "@plane/services";
import type { IInstanceInfo } from "@plane/types";
import { adminApiClient } from "@/services/api-client";

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class InstanceService {
  /** The instance info, or only its activation flags while the instance is not registered. */
  async getInstanceInfo(): Promise<IInstanceInfo | TUnregisteredInstance> {
    return toInstanceInfo(await unwrap(adminApiClient.GET("/api/instances/")));
  }
}
