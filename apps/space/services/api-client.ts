/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { AdminPaths, InternalPaths } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import { createApiClient } from "@plane/services";

/** Typed client for the internal API. */
export const apiClient = createApiClient<InternalPaths>(API_BASE_URL);

/** Typed client for the admin API, which also serves the public instance info. */
export const adminApiClient = createApiClient<AdminPaths>(API_BASE_URL);
