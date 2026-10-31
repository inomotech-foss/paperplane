/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unwrap } from "@plane/services";
import type { TTimezones } from "@plane/types";
import { apiClient } from "@/services/api-client";

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class TimezoneService {
  async fetch(): Promise<TTimezones> {
    return unwrap(apiClient.GET("/api/timezones/"));
  }
}

const timezoneService = new TimezoneService();

export default timezoneService;
