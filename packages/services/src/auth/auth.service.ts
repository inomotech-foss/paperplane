/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { InternalPaths } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import type { ICsrfTokenData } from "@plane/types";
import type { ApiClient } from "../client";
import { createApiClient, unwrap } from "../client";

/** Errors are thrown as `ApiError`. */
export class AuthService {
  private readonly client: ApiClient<InternalPaths>;

  constructor(BASE_URL?: string) {
    this.client = createApiClient<InternalPaths>(BASE_URL || API_BASE_URL);
  }

  async requestCSRFToken(): Promise<ICsrfTokenData> {
    return unwrap(this.client.GET("/auth/get-csrf-token/"));
  }
}
