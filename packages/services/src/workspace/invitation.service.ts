/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody, InternalPaths } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import type { IWorkspaceMemberInvitation, IWorkspaceBulkInviteFormData } from "@plane/types";
import { APIService } from "../api.service";
import type { ApiClient } from "../client";
import { createApiClient, unwrap } from "../client";

export type TWorkspaceInvitationUpdateBody = ApiRequestBody<"/api/workspaces/{slug}/invitations/{pk}/", "patch">;

const invitationPath = (slug: string, pk: string) => ({ path: { slug, pk } });

/**
 * Service class for managing workspace invitations
 * Handles operations related to inviting users to workspaces and managing invitations
 * @extends {APIService}
 * @remarks Methods on the typed client throw `ApiError`.
 */
export class WorkspaceInvitationService extends APIService {
  private readonly client: ApiClient<InternalPaths>;

  constructor(BASE_URL?: string) {
    super(BASE_URL || API_BASE_URL);
    this.client = createApiClient<InternalPaths>(BASE_URL || API_BASE_URL);
  }

  /**
   * Retrieves all workspace invitations for the current user
   * @returns {Promise<IWorkspaceMemberInvitation[]>} Promise resolving to array of workspace invitations
   */
  async userInvitations(): Promise<IWorkspaceMemberInvitation[]> {
    return unwrap(this.client.GET("/api/users/me/workspaces/invitations/"));
  }

  /**
   * Retrieves all invitations for a specific workspace
   * @param {string} workspaceSlug - The unique slug identifier for the workspace
   * @returns {Promise<IWorkspaceMemberInvitation[]>} Promise resolving to array of workspace invitations
   */
  async workspaceInvitations(workspaceSlug: string): Promise<IWorkspaceMemberInvitation[]> {
    return unwrap(
      this.client.GET("/api/workspaces/{slug}/invitations/", { params: { path: { slug: workspaceSlug } } })
    );
  }

  /**
   * Sends bulk invitations to users for a workspace
   * @param {string} workspaceSlug - The unique slug identifier for the workspace
   * @param {IWorkspaceBulkInviteFormData} data - Bulk invitation data containing user information
   * @returns {Promise<any>} Promise resolving to the invitation response
   * @throws {Error} If the API request fails
   */
  async invite(workspaceSlug: string, data: IWorkspaceBulkInviteFormData): Promise<any> {
    return this.post(`/api/workspaces/${workspaceSlug}/invitations/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Updates the role of an invitation
   * @param workspaceSlug
   * @param invitationId
   * @param data
   */
  async update(
    workspaceSlug: string,
    invitationId: string,
    data: TWorkspaceInvitationUpdateBody
  ): Promise<IWorkspaceMemberInvitation> {
    return unwrap(
      this.client.PATCH("/api/workspaces/{slug}/invitations/{pk}/", {
        params: invitationPath(workspaceSlug, invitationId),
        body: data,
      })
    );
  }

  /**
   * Delete Workspace invitation
   * @param workspaceSlug
   * @param invitationId
   */
  async destroy(workspaceSlug: string, invitationId: string): Promise<void> {
    return unwrap(
      this.client.DELETE("/api/workspaces/{slug}/invitations/{pk}/", {
        params: invitationPath(workspaceSlug, invitationId),
      })
    );
  }

  /**
   * Accepts an invitation to join a workspace
   * @param {string} workspaceSlug - The unique slug identifier for the workspace
   * @param {string} invitationId - The unique identifier for the invitation
   * @param {any} data - Additional data required for joining the workspace
   * @returns {Promise<any>} Promise resolving to the join response
   * @throws {Error} If the API request fails
   */
  async join(workspaceSlug: string, invitationId: string, data: any): Promise<any> {
    return this.post(`/api/workspaces/${workspaceSlug}/invitations/${invitationId}/join/`, data, {
      headers: {},
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Accepts multiple workspace invitations at once
   * @param {any} data - Data containing information about invitations to accept
   * @returns {Promise<any>} Promise resolving to the bulk join response
   * @throws {Error} If the API request fails
   */
  async joinMany(data: any): Promise<any> {
    return this.post("/api/users/me/workspaces/invitations/", data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
