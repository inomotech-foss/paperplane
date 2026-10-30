/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody, ApiResponse, ApiSchema } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import { unwrap } from "@plane/services";
import type {
  IWorkspace,
  IWorkspaceMemberMe,
  TPqlDialect,
  IWorkspaceMember,
  IWorkspaceMemberInvitation,
  IWorkspaceSearchResults,
  IUserProjectsRole,
  IWorkspaceView,
  TIssuesResponse,
  TLink,
  TSearchResponse,
  TSearchEntityRequestPayload,
  TWidgetEntityData,
  TActivityEntityData,
  IWorkspaceSidebarNavigationItem,
  IWorkspaceSidebarNavigation,
  IWorkspaceUserPropertiesResponse,
} from "@plane/types";
// services
import { apiClient } from "@/services/api-client";
import { APIService } from "@/services/api.service";

export type TLastVisitedWorkspace = ApiResponse<"/api/users/last-visited-workspace/", "get">;
export type TWorkspaceCreateBody = ApiRequestBody<"/api/workspaces/", "post">;
export type TWorkspaceUpdateBody = ApiRequestBody<"/api/workspaces/{slug}/", "patch">;
export type TWorkspaceInviteBody = ApiRequestBody<"/api/workspaces/{slug}/invitations/", "post">;
export type TWorkspaceJoinBody = ApiRequestBody<"/api/workspaces/{slug}/invitations/{pk}/join/", "post">;
export type TWorkspaceInvitationsJoinBody = ApiRequestBody<"/api/users/me/workspaces/invitations/", "post">;
export type TWorkspaceInvitationPublic = ApiSchema<"WorkSpaceMemberInvitePublic">;
export type TWorkspaceMemberUpdateBody = ApiRequestBody<"/api/workspaces/{slug}/members/{pk}/", "patch">;
export type TSlugAvailability = ApiSchema<"SlugAvailability">;
export type TMessageResponse = ApiSchema<"MessageResponse">;
export type TWorkspaceInvitationUpdateBody = ApiRequestBody<"/api/workspaces/{slug}/invitations/{pk}/", "patch">;

const workspacePath = (slug: string) => ({ path: { slug } });
const workspaceItemPath = (slug: string, pk: string) => ({ path: { slug, pk } });

/** Methods on the typed client throw `ApiError` from `@plane/services`. */
export class WorkspaceService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async userWorkspaces(): Promise<IWorkspace[]> {
    return unwrap(apiClient.GET("/api/users/me/workspaces/"));
  }

  async getWorkspace(workspaceSlug: string): Promise<IWorkspace> {
    return unwrap(apiClient.GET("/api/workspaces/{slug}/", { params: workspacePath(workspaceSlug) }));
  }

  async createWorkspace(data: TWorkspaceCreateBody): Promise<IWorkspace> {
    return unwrap(apiClient.POST("/api/workspaces/", { body: data }));
  }

  async updateWorkspace(workspaceSlug: string, data: TWorkspaceUpdateBody): Promise<IWorkspace> {
    return unwrap(apiClient.PATCH("/api/workspaces/{slug}/", { params: workspacePath(workspaceSlug), body: data }));
  }

  async deleteWorkspace(workspaceSlug: string): Promise<void> {
    return unwrap(apiClient.DELETE("/api/workspaces/{slug}/", { params: workspacePath(workspaceSlug) }));
  }

  async inviteWorkspace(workspaceSlug: string, data: TWorkspaceInviteBody): Promise<TMessageResponse> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/invitations/", { params: workspacePath(workspaceSlug), body: data })
    );
  }

  async joinWorkspace(
    workspaceSlug: string,
    invitationId: string,
    data: TWorkspaceJoinBody
  ): Promise<TMessageResponse> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/invitations/{pk}/join/", {
        params: workspaceItemPath(workspaceSlug, invitationId),
        body: data,
      })
    );
  }

  async joinWorkspaces(data: TWorkspaceInvitationsJoinBody): Promise<void> {
    return unwrap(apiClient.POST("/api/users/me/workspaces/invitations/", { body: data }));
  }

  /** The backend currently answers this route with a 500. */
  async getLastActiveWorkspaceAndProjects(): Promise<TLastVisitedWorkspace> {
    return unwrap(apiClient.GET("/api/users/last-visited-workspace/"));
  }

  async userWorkspaceInvitations(): Promise<IWorkspaceMemberInvitation[]> {
    return unwrap(apiClient.GET("/api/users/me/workspaces/invitations/"));
  }

  async workspaceMemberMe(workspaceSlug: string): Promise<IWorkspaceMemberMe> {
    return this.get(`/api/workspaces/${workspaceSlug}/workspace-members/me/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }

  async updateWorkspaceMemberMe(
    workspaceSlug: string,
    data: { pql_dialect: TPqlDialect | null }
  ): Promise<IWorkspaceMemberMe> {
    return unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/workspace-members/me/", { params: workspacePath(workspaceSlug), body: data })
    );
  }

  async updateWorkspaceView(
    workspaceSlug: string,
    data: ApiRequestBody<"/api/workspaces/{slug}/workspace-views/", "post">
  ): Promise<void> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/workspace-views/", { params: workspacePath(workspaceSlug), body: data })
    );
  }

  async fetchWorkspaceMembers(workspaceSlug: string): Promise<IWorkspaceMember[]> {
    return unwrap(apiClient.GET("/api/workspaces/{slug}/members/", { params: workspacePath(workspaceSlug) }));
  }

  async updateWorkspaceMember(
    workspaceSlug: string,
    memberId: string,
    data: TWorkspaceMemberUpdateBody
  ): Promise<IWorkspaceMember> {
    return unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/members/{pk}/", {
        params: workspaceItemPath(workspaceSlug, memberId),
        body: data,
      })
    );
  }

  async deleteWorkspaceMember(workspaceSlug: string, memberId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/members/{pk}/", { params: workspaceItemPath(workspaceSlug, memberId) })
    );
  }

  async workspaceInvitations(workspaceSlug: string): Promise<IWorkspaceMemberInvitation[]> {
    return unwrap(apiClient.GET("/api/workspaces/{slug}/invitations/", { params: workspacePath(workspaceSlug) }));
  }

  /** The public view of an invitation, without its token. */
  async getWorkspaceInvitation(workspaceSlug: string, invitationId: string): Promise<TWorkspaceInvitationPublic> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/invitations/{pk}/join/", {
        params: workspaceItemPath(workspaceSlug, invitationId),
      })
    );
  }

  async updateWorkspaceInvitation(
    workspaceSlug: string,
    invitationId: string,
    data: TWorkspaceInvitationUpdateBody
  ): Promise<IWorkspaceMemberInvitation> {
    return unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/invitations/{pk}/", {
        params: workspaceItemPath(workspaceSlug, invitationId),
        body: data,
      })
    );
  }

  async deleteWorkspaceInvitations(workspaceSlug: string, invitationId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/invitations/{pk}/", {
        params: workspaceItemPath(workspaceSlug, invitationId),
      })
    );
  }

  async workspaceSlugCheck(slug: string): Promise<TSlugAvailability> {
    return unwrap(apiClient.GET("/api/workspace-slug-check/", { params: { query: { slug } } }));
  }

  async searchWorkspace(
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

  async createView(workspaceSlug: string, data: Partial<IWorkspaceView>): Promise<IWorkspaceView> {
    return this.post(`/api/workspaces/${workspaceSlug}/views/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateView(workspaceSlug: string, viewId: string, data: Partial<IWorkspaceView>): Promise<IWorkspaceView> {
    return this.patch(`/api/workspaces/${workspaceSlug}/views/${viewId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteView(workspaceSlug: string, viewId: string): Promise<any> {
    return this.delete(`/api/workspaces/${workspaceSlug}/views/${viewId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getAllViews(workspaceSlug: string): Promise<IWorkspaceView[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/views/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getViewDetails(workspaceSlug: string, viewId: string): Promise<IWorkspaceView> {
    return this.get(`/api/workspaces/${workspaceSlug}/views/${viewId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getViewIssues(workspaceSlug: string, params: any, config = {}): Promise<TIssuesResponse> {
    const path = params.expand?.includes("issue_relation")
      ? `/api/workspaces/${workspaceSlug}/issues-detail/`
      : `/api/workspaces/${workspaceSlug}/issues/`;
    return this.get(
      path,
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

  async getWorkspaceUserProjectsRole(workspaceSlug: string): Promise<IUserProjectsRole> {
    return unwrap(
      apiClient.GET("/api/users/me/workspaces/{slug}/project-roles/", { params: workspacePath(workspaceSlug) })
    );
  }

  // quicklinks
  async fetchWorkspaceLinks(workspaceSlug: string): Promise<TLink[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/quick-links/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }

  async createWorkspaceLink(workspaceSlug: string, data: Partial<TLink>): Promise<TLink> {
    return this.post(`/api/workspaces/${workspaceSlug}/quick-links/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }

  async updateWorkspaceLink(workspaceSlug: string, linkId: string, data: Partial<TLink>): Promise<TLink> {
    return this.patch(`/api/workspaces/${workspaceSlug}/quick-links/${linkId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }

  async deleteWorkspaceLink(workspaceSlug: string, linkId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/quick-links/${linkId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async searchEntity(workspaceSlug: string, params: TSearchEntityRequestPayload): Promise<TSearchResponse> {
    return this.get(`/api/workspaces/${workspaceSlug}/entity-search/`, {
      params: {
        ...params,
        query_type: params.query_type.join(","),
      },
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  // recents
  async fetchWorkspaceRecents(workspaceSlug: string, entity_name?: string): Promise<TActivityEntityData[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/recent-visits/`, {
      params: {
        entity_name,
      },
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }

  // widgets
  async fetchWorkspaceWidgets(workspaceSlug: string): Promise<TWidgetEntityData[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/home-preferences/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }

  async updateWorkspaceWidget(
    workspaceSlug: string,
    widgetKey: string,
    data: Partial<TWidgetEntityData>
  ): Promise<TWidgetEntityData> {
    return this.patch(`/api/workspaces/${workspaceSlug}/home-preferences/${widgetKey}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }

  async fetchSidebarNavigationPreferences(workspaceSlug: string): Promise<IWorkspaceSidebarNavigation> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/sidebar-preferences/", { params: workspacePath(workspaceSlug) })
    );
  }

  /** The backend has no such route, so this always fails. */

  async updateSidebarPreference(
    workspaceSlug: string,
    key: string,
    data: Partial<IWorkspaceSidebarNavigationItem>
  ): Promise<IWorkspaceSidebarNavigationItem> {
    return this.patch(`/api/workspaces/${workspaceSlug}/sidebar-preferences/${key}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }

  async updateBulkSidebarPreferences(
    workspaceSlug: string,
    data: Array<{ key: string; is_pinned: boolean; sort_order: number }>
  ): Promise<TMessageResponse> {
    return unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/sidebar-preferences/", {
        params: workspacePath(workspaceSlug),
        body: data,
      })
    );
  }

  async fetchWorkspaceFilters(workspaceSlug: string): Promise<IWorkspaceUserPropertiesResponse> {
    return this.get(`/api/workspaces/${workspaceSlug}/user-properties/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async patchWorkspaceFilters(
    workspaceSlug: string,
    data: Partial<IWorkspaceUserPropertiesResponse>
  ): Promise<IWorkspaceUserPropertiesResponse> {
    return this.patch(`/api/workspaces/${workspaceSlug}/user-properties/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
