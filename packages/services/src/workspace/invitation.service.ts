/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody, ApiSchema, InternalPaths } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import type { IWorkspaceMemberInvitation } from "@plane/types";
import type { ApiClient } from "../client";
import { createApiClient, unwrap } from "../client";

export type TWorkspaceInvitationUpdateBody = ApiRequestBody<"/api/workspaces/{slug}/invitations/{pk}/", "patch">;
export type TWorkspaceInviteBody = ApiRequestBody<"/api/workspaces/{slug}/invitations/", "post">;
export type TWorkspaceJoinBody = ApiRequestBody<"/api/workspaces/{slug}/invitations/{pk}/join/", "post">;
export type TWorkspaceInvitationsJoinBody = ApiRequestBody<"/api/users/me/workspaces/invitations/", "post">;

const invitationPath = (slug: string, pk: string) => ({ path: { slug, pk } });

/**
 * Service class for managing workspace invitations
 * Handles operations related to inviting users to workspaces and managing invitations
 * @remarks Errors are thrown as `ApiError`.
 */
export class WorkspaceInvitationService {
  private readonly client: ApiClient<InternalPaths>;

  constructor(BASE_URL?: string) {
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
   * @param {TWorkspaceInviteBody} data - Bulk invitation data containing user information
   */
  async invite(workspaceSlug: string, data: TWorkspaceInviteBody): Promise<ApiSchema<"MessageResponse">> {
    return unwrap(
      this.client.POST("/api/workspaces/{slug}/invitations/", { params: { path: { slug: workspaceSlug } }, body: data })
    );
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
   * @param {TWorkspaceJoinBody} data - The token from the invitation email and whether to accept
   */
  async join(
    workspaceSlug: string,
    invitationId: string,
    data: TWorkspaceJoinBody
  ): Promise<ApiSchema<"MessageResponse">> {
    return unwrap(
      this.client.POST("/api/workspaces/{slug}/invitations/{pk}/join/", {
        params: invitationPath(workspaceSlug, invitationId),
        body: data,
      })
    );
  }

  /**
   * Accepts multiple workspace invitations at once
   * @param {TWorkspaceInvitationsJoinBody} data - The ids of the invitations to accept
   */
  async joinMany(data: TWorkspaceInvitationsJoinBody): Promise<void> {
    return unwrap(this.client.POST("/api/users/me/workspaces/invitations/", { body: data }));
  }
}
