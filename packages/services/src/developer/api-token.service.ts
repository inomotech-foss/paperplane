/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { InternalPaths } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import type { IApiToken } from "@plane/types";
import { APIService } from "../api.service";
import type { ApiClient } from "../client";
import { createApiClient, unwrap } from "../client";

/** Methods on the typed client throw `ApiError`. */
export class APITokenService extends APIService {
  private readonly client: ApiClient<InternalPaths>;

  constructor(BASE_URL?: string) {
    super(BASE_URL || API_BASE_URL);
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
   * @param {Partial<IApiToken>} data - The data for creating the new API token
   * @returns {Promise<IApiToken>} The newly created API token
   * @throws {Error} Throws response data if the request fails
   */
  async create(data: Partial<IApiToken>): Promise<IApiToken> {
    return this.post(`/api/users/api-tokens/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Deletes a specific API token
   * @param {string} tokenId - The unique identifier of the API token to delete
   */
  async destroy(tokenId: string): Promise<void> {
    return unwrap(this.client.DELETE("/api/users/api-tokens/{pk}/", { params: { path: { pk: tokenId } } }));
  }
}
