/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody, InternalPaths } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import type { IWorkspaceMemberMe, IWorkspaceMember, IUserProjectsRole } from "@plane/types";
import { APIService } from "../api.service";
import type { ApiClient } from "../client";
import { createApiClient, unwrap } from "../client";

export type TWorkspaceMemberUpdateBody = ApiRequestBody<"/api/workspaces/{slug}/members/{pk}/", "patch">;

/**
 * Service class for managing workspace members
 * Handles operations related to workspace membership, including member information,
 * updates, deletions, and role management
 * @extends {APIService}
 * @remarks Methods on the typed client throw `ApiError`.
 */
export class WorkspaceMemberService extends APIService {
  private readonly client: ApiClient<InternalPaths>;

  /**
   * Creates an instance of WorkspaceMemberService
   * @param {string} baseUrl - The base URL for API requests
   */
  constructor(BASE_URL?: string) {
    super(BASE_URL || API_BASE_URL);
    this.client = createApiClient<InternalPaths>(BASE_URL || API_BASE_URL);
  }

  /**
   * Retrieves current user's information for a specific workspace
   * @param {string} workspaceSlug - The unique slug identifier for the workspace
   * @returns {Promise<IWorkspaceMemberMe>} Promise resolving to current user's workspace member information
   * @throws {Error} If the API request fails
   */
  async myInfo(workspaceSlug: string): Promise<IWorkspaceMemberMe> {
    return this.get(`/api/workspaces/${workspaceSlug}/workspace-members/me/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }

  /**
   * Retrieves all members of a specific workspace
   * @param {string} workspaceSlug - The unique slug identifier for the workspace
   * @returns {Promise<IWorkspaceMember[]>} Promise resolving to array of workspace members
   */
  async list(workspaceSlug: string): Promise<IWorkspaceMember[]> {
    return unwrap(this.client.GET("/api/workspaces/{slug}/members/", { params: { path: { slug: workspaceSlug } } }));
  }

  /**
   * Updates a workspace member's information
   * @param {string} workspaceSlug - The unique slug identifier for the workspace
   * @param {string} memberId - The unique identifier for the member
   * @param {TWorkspaceMemberUpdateBody} data - The new role, the only field the API accepts
   * @returns {Promise<IWorkspaceMember>} Promise resolving to the updated member information
   */
  async update(workspaceSlug: string, memberId: string, data: TWorkspaceMemberUpdateBody): Promise<IWorkspaceMember> {
    return unwrap(
      this.client.PATCH("/api/workspaces/{slug}/members/{pk}/", {
        params: { path: { slug: workspaceSlug, pk: memberId } },
        body: data,
      })
    );
  }

  /**
   * Removes a member from a workspace
   * @param {string} workspaceSlug - The unique slug identifier for the workspace
   * @param {string} memberId - The unique identifier for the member to remove
   * @returns {Promise<any>} Promise resolving to the deletion response
   * @throws {Error} If the API request fails
   */
  async destroy(workspaceSlug: string, memberId: string): Promise<void> {
    return unwrap(
      this.client.DELETE("/api/workspaces/{slug}/members/{pk}/", {
        params: { path: { slug: workspaceSlug, pk: memberId } },
      })
    );
  }

  /**
   * Retrieves the current user's project roles within a workspace
   * @param {string} workspaceSlug - The unique slug identifier for the workspace
   * @returns {Promise<IUserProjectsRole>} Promise resolving to user's project roles
   * @throws {Error} If the API request fails
   */
  async getWorkspaceUserProjectsRole(workspaceSlug: string): Promise<IUserProjectsRole> {
    return unwrap(
      this.client.GET("/api/users/me/workspaces/{slug}/project-roles/", { params: { path: { slug: workspaceSlug } } })
    );
  }
}
