/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { AdminApiResponse, AdminApiSchema, AdminPaths, RequestBodyOf } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import { APIService } from "../api.service";
import type { ApiClient } from "../client";
import { createApiClient, unwrap } from "../client";

export type TInstanceWorkspace = AdminApiSchema<"Workspace">;
export type TInstanceWorkspaceList = AdminApiResponse<"/api/instances/workspaces/", "get">;
export type TInstanceWorkspaceCreateBody = RequestBodyOf<AdminPaths, "/api/instances/workspaces/", "post">;

/**
 * Service class for managing instance workspaces
 * Handles CRUD operations on instance workspaces
 * @extends APIService
 * @remarks Methods on the typed client throw `ApiError`.
 */
export class InstanceWorkspaceService extends APIService {
  private readonly client: ApiClient<AdminPaths>;

  /**
   * Constructor for InstanceWorkspaceService
   * @param BASE_URL - Base URL for API requests
   */
  constructor(BASE_URL?: string) {
    super(BASE_URL || API_BASE_URL);
    this.client = createApiClient<AdminPaths>(BASE_URL || API_BASE_URL);
  }

  /**
   * Retrieves a paginated list of workspaces for the current instance
   * @param {string} nextPageCursor - Optional cursor to retrieve the next page of results
   * @returns {Promise<TInstanceWorkspaceList>} Promise resolving to a paginated list of workspaces
   */
  async list(nextPageCursor?: string): Promise<TInstanceWorkspaceList> {
    return unwrap(
      this.client.GET("/api/instances/workspaces/", {
        params: { query: nextPageCursor === undefined ? {} : { cursor: nextPageCursor } },
      })
    );
  }

  /**
   * Checks if a workspace slug is available
   * @param {string} slug - The workspace slug to check
   * @returns {Promise<any>} Promise resolving to slug availability status
   * @throws {Error} If the API request fails
   */
  async slugCheck(slug: string): Promise<any> {
    const params = new URLSearchParams({ slug });
    return this.get(`/api/instances/workspace-slug-check/?${params.toString()}`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Creates a new workspace
   * @param {TInstanceWorkspaceCreateBody} data - Workspace data for creation
   * @returns {Promise<TInstanceWorkspace>} Promise resolving to the created workspace
   */
  async create(data: TInstanceWorkspaceCreateBody): Promise<TInstanceWorkspace> {
    return unwrap(this.client.POST("/api/instances/workspaces/", { body: data }));
  }

  async retrieve(workspaceId: string): Promise<TInstanceWorkspace> {
    return unwrap(this.client.GET("/api/instances/workspaces/{pk}/", { params: { path: { pk: workspaceId } } }));
  }

  async destroy(workspaceId: string): Promise<void> {
    return unwrap(this.client.DELETE("/api/instances/workspaces/{pk}/", { params: { path: { pk: workspaceId } } }));
  }

  async transferOwner(workspaceId: string, ownerId: string): Promise<TInstanceWorkspace> {
    return this.post(`/api/instances/workspaces/${workspaceId}/transfer-owner/`, { owner: ownerId })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
