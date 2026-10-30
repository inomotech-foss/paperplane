/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// services
import type { ApiRequestBody, ApiResponse } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import { unwrap } from "@plane/services";
import type {
  IUser,
  IUserActivityResponse,
  IInstanceAdminStatus,
  IUserProfileData,
  IUserProfileProjectSegregation,
  IUserSettings,
  IUserEmailNotificationSettings,
  TIssuesResponse,
  TUserProfile,
  IEmailCheckResponse,
} from "@plane/types";
import { apiClient, apiClientWithoutRedirect } from "@/services/api-client";
import { APIService } from "@/services/api.service";

export type TUserAccount = ApiResponse<"/api/users/me/accounts/", "get">[number];
export type TEmailNotificationSettingsBody = ApiRequestBody<"/api/users/me/notification-preferences/", "patch">;

const userPath = (slug: string, user_id: string) => ({ path: { slug, user_id } });

/** Methods on the typed client throw `ApiError` from `@plane/services`. */
export class UserService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  /** Resolves to `undefined` for any error status and never redirects to sign in. */
  async currentUser(): Promise<IUser | undefined> {
    const { data } = await apiClientWithoutRedirect.GET("/api/users/me/");
    return data;
  }

  async getCurrentUserProfile(): Promise<TUserProfile> {
    return this.get("/api/users/me/profile/")
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }

  async updateCurrentUserProfile(data: any): Promise<any> {
    return this.patch("/api/users/me/profile/", data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }

  async getCurrentUserAccounts(): Promise<TUserAccount[]> {
    return unwrap(apiClient.GET("/api/users/me/accounts/"));
  }

  async currentUserInstanceAdminStatus(): Promise<IInstanceAdminStatus> {
    return unwrap(apiClient.GET("/api/users/me/instance-admin/"));
  }

  /** `bustCache` skips the browser cache. */
  async currentUserSettings(bustCache: boolean = false): Promise<IUserSettings> {
    return unwrap(apiClient.GET("/api/users/me/settings/", bustCache ? { cache: "no-store" } : {}));
  }

  async currentUserEmailNotificationSettings(): Promise<IUserEmailNotificationSettings> {
    return unwrap(apiClient.GET("/api/users/me/notification-preferences/"));
  }

  async updateUser(data: Partial<IUser>): Promise<any> {
    return this.patch("/api/users/me/", data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateUserOnBoard(): Promise<any> {
    return this.patch("/api/users/me/onboard/", {
      is_onboarded: true,
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateUserTourCompleted(): Promise<any> {
    return this.patch("/api/users/me/tour-completed/", {
      is_tour_completed: true,
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateCurrentUserEmailNotificationSettings(
    data: TEmailNotificationSettingsBody
  ): Promise<IUserEmailNotificationSettings> {
    return unwrap(apiClient.PATCH("/api/users/me/notification-preferences/", { body: data }));
  }

  async changePassword(token: string, data: { old_password?: string; new_password: string }): Promise<any> {
    return this.post(`/auth/change-password/`, data, {
      headers: {
        "X-CSRFTOKEN": token,
      },
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getUserProfileData(workspaceSlug: string, userId: string): Promise<IUserProfileData> {
    return this.get(`/api/workspaces/${workspaceSlug}/user-stats/${userId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getUserProfileProjectsSegregation(
    workspaceSlug: string,
    userId: string
  ): Promise<IUserProfileProjectSegregation> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/user-profile/{user_id}/", { params: userPath(workspaceSlug, userId) })
    );
  }

  async getUserProfileActivity(
    workspaceSlug: string,
    userId: string,
    params: {
      per_page: number;
      cursor?: string;
    }
  ): Promise<IUserActivityResponse> {
    return this.get(`/api/workspaces/${workspaceSlug}/user-activity/${userId}/`, {
      params,
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async downloadProfileActivity(
    workspaceSlug: string,
    userId: string,
    data: {
      date: string;
    }
  ): Promise<any> {
    return this.post(`/api/workspaces/${workspaceSlug}/user-activity/${userId}/export/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getUserProfileIssues(
    workspaceSlug: string,
    userId: string,
    params: any,
    config = {}
  ): Promise<TIssuesResponse> {
    return this.get(
      `/api/workspaces/${workspaceSlug}/user-issues/${userId}/`,
      {
        params,
      },
      config
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deactivateAccount(): Promise<void> {
    return unwrap(apiClient.DELETE("/api/users/me/"));
  }

  async leaveWorkspace(workspaceSlug: string) {
    return this.post(`/api/workspaces/${workspaceSlug}/members/leave/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async joinProject(workspaceSlug: string, project_ids: string[]): Promise<any> {
    return this.post(`/api/users/me/workspaces/${workspaceSlug}/projects/invitations/`, { project_ids })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async leaveProject(workspaceSlug: string, projectId: string) {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/members/leave/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async checkEmail(token: string, email: string): Promise<IEmailCheckResponse> {
    return this.post(
      "/auth/email-check/",
      { email },
      {
        headers: {
          "X-CSRFTOKEN": token,
        },
      }
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async generateEmailCode(data: { email: string }): Promise<any> {
    return this.post("/api/users/me/email/generate-code/", data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async verifyEmailCode(data: { email: string; code: string }): Promise<any> {
    return this.patch("/api/users/me/email/", data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}

const userService = new UserService();

export default userService;
