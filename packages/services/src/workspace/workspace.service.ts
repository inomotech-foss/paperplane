/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody, ApiResponse, InternalPaths } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import type { IWorkspace, IWorkspaceSearchResults } from "@plane/types";
import { APIService } from "../api.service";
import type { ApiClient } from "../client";
import { createApiClient, unwrap } from "../client";

export type TWorkspaceCreateBody = ApiRequestBody<"/api/workspaces/", "post">;
export type TWorkspaceUpdateBody = ApiRequestBody<"/api/workspaces/{slug}/", "patch">;
/** The backend currently answers this route with a 500. */
export type TLastVisitedWorkspace = ApiResponse<"/api/users/last-visited-workspace/", "get">;

const workspacePath = (slug: string) => ({ path: { slug } });

/**
 * Service class for managing workspace operations
 * Handles CRUD operations and various workspace-related functionalities
 * @extends {APIService}
 * @remarks Methods on the typed client throw `ApiError`.
 */
export class WorkspaceService extends APIService {
  private readonly client: ApiClient<InternalPaths>;

  /**
   * Creates an instance of WorkspaceService
   * @param {string} baseUrl - The base URL for API requests
   */
  constructor(BASE_URL?: string) {
    super(BASE_URL || API_BASE_URL);
    this.client = createApiClient<InternalPaths>(BASE_URL || API_BASE_URL);
  }

  /**
   * Retrieves all workspaces for the current user
   * @returns {Promise<IWorkspace[]>} Promise resolving to an array of workspaces
   */
  async list(): Promise<IWorkspace[]> {
    return unwrap(this.client.GET("/api/users/me/workspaces/"));
  }

  /**
   * Retrieves details of a specific workspace
   * @param {string} workspaceSlug - The unique slug identifier for the workspace
   * @returns {Promise<IWorkspace>} Promise resolving to workspace details
   */
  async retrieve(workspaceSlug: string): Promise<IWorkspace> {
    return unwrap(this.client.GET("/api/workspaces/{slug}/", { params: workspacePath(workspaceSlug) }));
  }

  /**
   * Creates a new workspace
   * @param {TWorkspaceCreateBody} data - Workspace data for creation
   * @returns {Promise<IWorkspace>} Promise resolving to the created workspace
   */
  async create(data: TWorkspaceCreateBody): Promise<IWorkspace> {
    return unwrap(this.client.POST("/api/workspaces/", { body: data }));
  }

  /**
   * Updates an existing workspace
   * @param {string} workspaceSlug - The unique slug identifier for the workspace
   * @param {TWorkspaceUpdateBody} data - Updated workspace data
   * @returns {Promise<IWorkspace>} Promise resolving to the updated workspace
   */
  async update(workspaceSlug: string, data: TWorkspaceUpdateBody): Promise<IWorkspace> {
    return unwrap(this.client.PATCH("/api/workspaces/{slug}/", { params: workspacePath(workspaceSlug), body: data }));
  }

  /**
   * Deletes a workspace
   * @param {string} workspaceSlug - The unique slug identifier for the workspace
   */
  async destroy(workspaceSlug: string): Promise<void> {
    return unwrap(this.client.DELETE("/api/workspaces/{slug}/", { params: workspacePath(workspaceSlug) }));
  }

  /**
   * Retrieves information about the user's last visited workspace
   * @returns {Promise<TLastVisitedWorkspace>} Promise resolving to last active workspace details
   */
  async lastVisited(): Promise<TLastVisitedWorkspace> {
    return unwrap(this.client.GET("/api/users/last-visited-workspace/"));
  }

  /**
   * Checks if a workspace slug is available
   * @param {string} slug - The workspace slug to check
   * @returns {Promise<any>} Promise resolving to slug availability status
   * @throws {Error} If the API request fails
   */
  async slugCheck(slug: string): Promise<any> {
    return this.get(`/api/workspace-slug-check/?slug=${slug}`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Searches within a workspace
   * @param {string} workspaceSlug - The unique slug identifier for the workspace
   * @param {Object} params - Search parameters
   * @param {string} [params.project_id] - Optional project ID to scope the search
   * @param {string} params.search - Search query string
   * @param {boolean} params.workspace_search - Whether to search across the entire workspace
   * @returns {Promise<IWorkspaceSearchResults>} Promise resolving to search results
   * @throws {Error} If the API request fails
   */
  async search(
    workspaceSlug: string,
    params: {
      project_id?: string;
      search: string;
      workspace_search: boolean;
    }
  ): Promise<IWorkspaceSearchResults> {
    return this.get(`/api/workspaces/${workspaceSlug}/search/`, {
      params,
    })
      .then((res) => res?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
