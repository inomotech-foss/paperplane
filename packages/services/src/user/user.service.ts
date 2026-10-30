/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type { AdminApiResponse, AdminPaths, ApiRequestBody, ApiResponse, InternalPaths } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import type { IUser, TUserProfile } from "@plane/types";
// api service
import { APIService } from "../api.service";
import type { ApiClient } from "../client";
import { createApiClient, unwrap } from "../client";

export type TInstanceAdminMe = AdminApiResponse<"/api/instances/admins/me/", "get">;
export type TUserUpdateBody = ApiRequestBody<"/api/users/me/", "patch">;
export type TUserUpdateResponse = ApiResponse<"/api/users/me/", "patch">;

/** The writable fields of `data`. The API ignores the others, such as `avatar_url`. */
export const userUpdateBody = (data: Partial<IUser>): TUserUpdateBody => ({
  first_name: data.first_name,
  last_name: data.last_name,
  display_name: data.display_name,
  cover_image: data.cover_image,
  cover_image_asset: data.cover_image_asset,
  user_timezone: data.user_timezone,
});

/**
 * Service class for managing user operations
 * Handles operations for retrieving the current user's details and perform CRUD operations
 * @extends {APIService}
 * @remarks Methods on the typed client throw `ApiError`.
 */
export class UserService extends APIService {
  private readonly client: ApiClient<InternalPaths>;
  private readonly adminClient: ApiClient<AdminPaths>;

  /**
   * Constructor for UserService
   * @param BASE_URL - Base URL for API requests
   */
  constructor(BASE_URL?: string) {
    super(BASE_URL || API_BASE_URL);
    this.client = createApiClient<InternalPaths>(BASE_URL || API_BASE_URL);
    this.adminClient = createApiClient<AdminPaths>(BASE_URL || API_BASE_URL);
  }

  /**
   * Retrieves the current user details
   * @returns {Promise<IUser>} Promise resolving to the current user details
   */
  async me(): Promise<IUser> {
    return unwrap(this.client.GET("/api/users/me/"));
  }

  /**
   * Updates the current user details. Sends only the fields the API writes.
   * @param {Partial<IUser>} data Data to update the user with
   * @returns {Promise<TUserUpdateResponse>} Promise resolving to the updated user details
   */
  async update(data: Partial<IUser>): Promise<TUserUpdateResponse> {
    return unwrap(this.client.PATCH("/api/users/me/", { body: userUpdateBody(data) }));
  }

  /**
   * Retrieves the current user's profile details
   * @returns {Promise<TUserProfile>} Promise resolving to the current user's profile details
   * @throws {Error} If the API request fails
   */
  async profile(): Promise<TUserProfile> {
    return this.get("/api/users/me/profile/")
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }

  /**
   * Updates the current user's profile details
   * @param {Partial<TUserProfile>} data Data to update the user's profile with
   * @returns {Promise<TUserProfile>} Promise resolving to the updated user's profile details
   * @throws {Error} If the API request fails
   */
  async updateProfile(data: Partial<TUserProfile>): Promise<TUserProfile> {
    return this.patch("/api/users/me/profile/", data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }

  /**
   * Retrieves the current instance admin details
   * @returns {Promise<TInstanceAdminMe>} Promise resolving to the current instance admin details
   */
  async adminDetails(): Promise<TInstanceAdminMe> {
    return unwrap(this.adminClient.GET("/api/instances/admins/me/"));
  }
}
