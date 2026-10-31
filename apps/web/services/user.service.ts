/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { AxiosRequestConfig } from "axios";
// services
import type { ApiRequestBody, ApiResponse, ApiSchema } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import { toUserProfile, unwrap, userUpdateBody } from "@plane/services";
import type { TUserUpdateResponse } from "@plane/services";
import type {
  IUser,
  IUserActivityResponse,
  IInstanceAdminStatus,
  IUserProfileData,
  IUserProfileProjectSegregation,
  IUserSettings,
  IUserEmailNotificationSettings,
  TIssueParams,
  TIssuesResponse,
  TUserProfile,
  TStateGroups,
  IEmailCheckResponse,
} from "@plane/types";
import { apiClient, apiClientWithoutRedirect } from "@/services/api-client";
import { APIService } from "@/services/api.service";

export type TUserAccount = ApiResponse<"/api/users/me/accounts/", "get">[number];
export type TEmailNotificationSettingsBody = ApiRequestBody<"/api/users/me/notification-preferences/", "patch">;
export type TMessageResponse = ApiSchema<"MessageResponse">;
export type TChangePasswordBody = ApiRequestBody<"/auth/change-password/", "post">;

const userPath = (slug: string, user_id: string) => ({ path: { slug, user_id } });

type TStateGroupCount = ApiSchema<"StateGroupCount">;

export const hasChartStateGroup = (row: TStateGroupCount): row is TStateGroupCount & { state_group: TStateGroups } =>
  row.state_group !== null && row.state_group !== "triage";

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
    return toUserProfile(await unwrap(apiClient.GET("/api/users/me/profile/")));
  }

  async updateCurrentUserProfile(data: Partial<TUserProfile>): Promise<TUserProfile> {
    return toUserProfile(await unwrap(apiClient.PATCH("/api/users/me/profile/", { body: data })));
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

  /** Sends only the fields the API writes. */
  async updateUser(data: Partial<IUser>): Promise<TUserUpdateResponse> {
    return unwrap(apiClient.PATCH("/api/users/me/", { body: userUpdateBody(data) }));
  }

  async updateUserOnBoard(): Promise<TMessageResponse> {
    return unwrap(apiClient.PATCH("/api/users/me/onboard/", { body: { is_onboarded: true } }));
  }

  async updateUserTourCompleted(): Promise<TMessageResponse> {
    return unwrap(apiClient.PATCH("/api/users/me/tour-completed/", { body: { is_tour_completed: true } }));
  }

  async updateCurrentUserEmailNotificationSettings(
    data: TEmailNotificationSettingsBody
  ): Promise<IUserEmailNotificationSettings> {
    return unwrap(apiClient.PATCH("/api/users/me/notification-preferences/", { body: data }));
  }

  async changePassword(token: string, data: TChangePasswordBody): Promise<TMessageResponse> {
    return unwrap(apiClient.POST("/auth/change-password/", { body: data, headers: { "X-CSRFTOKEN": token } }));
  }

  /** Leaves out work items without a state or in triage, which the profile charts have no group for. */
  async getUserProfileData(workspaceSlug: string, userId: string): Promise<IUserProfileData> {
    const data = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/user-stats/{user_id}/", { params: userPath(workspaceSlug, userId) })
    );
    return { ...data, state_distribution: data.state_distribution.filter(hasChartStateGroup) };
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
  ): Promise<string> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/user-activity/{user_id}/export/", {
        params: userPath(workspaceSlug, userId),
        body: data,
        parseAs: "text",
      })
    );
  }

  async getUserProfileIssues(
    workspaceSlug: string,
    userId: string,
    params: Partial<Record<TIssueParams, string | boolean>>,
    config: AxiosRequestConfig = {}
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

  async leaveWorkspace(workspaceSlug: string): Promise<void> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/members/leave/", { params: { path: { slug: workspaceSlug } } })
    );
  }

  async joinProject(workspaceSlug: string, project_ids: string[]): Promise<TMessageResponse> {
    return unwrap(
      apiClient.POST("/api/users/me/workspaces/{slug}/projects/invitations/", {
        params: { path: { slug: workspaceSlug } },
        body: { project_ids },
      })
    );
  }

  async leaveProject(workspaceSlug: string, projectId: string): Promise<void> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/members/leave/", {
        params: { path: { slug: workspaceSlug, project_id: projectId } },
      })
    );
  }

  async checkEmail(token: string, email: string): Promise<IEmailCheckResponse> {
    return unwrap(apiClient.POST("/auth/email-check/", { body: { email }, headers: { "X-CSRFTOKEN": token } }));
  }

  async generateEmailCode(data: { email: string }): Promise<TMessageResponse> {
    return unwrap(apiClient.POST("/api/users/me/email/generate-code/", { body: data }));
  }

  async verifyEmailCode(data: { email: string; code: string }): Promise<IUser> {
    return unwrap(apiClient.PATCH("/api/users/me/email/", { body: data }));
  }
}

const userService = new UserService();

export default userService;
