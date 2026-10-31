/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody, InternalPaths } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import type { IApiToken } from "@plane/types";
import type { ApiClient } from "../client";
import { createApiClient, unwrap } from "../client";

export type TApiTokenCreateBody = ApiRequestBody<"/api/users/api-tokens/", "post">;

/** Errors are thrown as `ApiError`. */
export class APITokenService {
  private readonly client: ApiClient<InternalPaths>;

  constructor(BASE_URL?: string) {
    this.client = createApiClient<InternalPaths>(BASE_URL || API_BASE_URL);
  }

  /**
   * Retrieves all API tokens of the current user
   * @returns {Promise<IApiToken[]>} Array of API tokens
   */
  async list(): Promise<IApiToken[]> {
    return unwrap(this.client.GET("/api/users/api-tokens/"));
  }

  /**
   * Retrieves a specific API token by its ID
   * @param {string} tokenId - The unique identifier of the API token
   * @returns {Promise<IApiToken>} The requested API token's details
   */
  async retrieve(tokenId: string): Promise<IApiToken> {
    return unwrap(this.client.GET("/api/users/api-tokens/{pk}/", { params: { path: { pk: tokenId } } }));
  }

  /**
   * Creates a new API token for a workspace
   * @param {TApiTokenCreateBody} data - The data for creating the new API token
   * @returns {Promise<IApiToken>} The newly created API token, the only response that includes `token`
   */
  async create(data: TApiTokenCreateBody): Promise<IApiToken> {
    return unwrap(this.client.POST("/api/users/api-tokens/", { body: data }));
  }

  /**
   * Deletes a specific API token
   * @param {string} tokenId - The unique identifier of the API token to delete
   */
  async destroy(tokenId: string): Promise<void> {
    return unwrap(this.client.DELETE("/api/users/api-tokens/{pk}/", { params: { path: { pk: tokenId } } }));
  }
}
