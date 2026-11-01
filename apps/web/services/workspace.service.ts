/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody, ApiResponse, ApiSchema } from "@plane/api-types";
import { toWorkspaceMemberMe, toWorkspaceSearchResults, unwrap, workspaceSearchQuery } from "@plane/services";
import type { TWorkspaceMemberMeUpdateBody, TWorkspaceSearchParams } from "@plane/services";
import { isOneOf, parseIssueFiltersResponse, parseLogoProps, RECENT_ENTITY_NAMES } from "@plane/types";
import type {
  IWorkspace,
  IWorkspaceMemberMe,
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
  TLogoProps,
  TIssueEntityData,
  TPageEntityData,
  TProjectEntityData,
  IWorkspaceSidebarNavigation,
  IWorkspaceUserPropertiesResponse,
} from "@plane/types";
// services
import { apiClient } from "@/services/api-client";
import type { TRequestOptions } from "@/services/issue/issue.service";
import { toWorkspaceIssueListQuery } from "@/services/issue/issue-query";
import type { TIssueParamsRecord } from "@/services/issue/issue-query";
import { toIssuesResponse } from "@/services/issue/work-item";
import { toViewCreateBody, toViewUpdateBody, toWorkspaceView } from "@/services/view-convert";

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

export type TWorkspaceLinkCreateBody = ApiRequestBody<"/api/workspaces/{slug}/quick-links/", "post">;
export type TWorkspaceLinkUpdateBody = ApiRequestBody<"/api/workspaces/{slug}/quick-links/{pk}/", "patch">;
export type TWorkspaceWidgetUpdateBody = ApiRequestBody<"/api/workspaces/{slug}/home-preferences/{key}/", "patch">;
export type TWorkspaceWidgetUpdateResponse = ApiSchema<"WorkspaceHomePreference">;

const toWorkspaceUserProperties = (
  properties: ApiSchema<"WorkspaceUserProperties">
): IWorkspaceUserPropertiesResponse => ({ ...properties, ...parseIssueFiltersResponse(properties) });

const toRecentEntity = (
  entity: ApiSchema<"RecentVisitEntity"> | null
): TPageEntityData | TProjectEntityData | TIssueEntityData | null =>
  entity && "logo_props" in entity ? { ...entity, logo_props: parseLogoProps(entity.logo_props) } : entity;

const withParsedLogo = <T extends { logo_props: unknown }>(
  entity: T
): Omit<T, "logo_props"> & { logo_props: TLogoProps } => ({
  ...entity,
  logo_props: parseLogoProps(entity.logo_props),
});

/** Leaves out visits of entity types the home page cannot show. */
export const toRecentVisits = (visits: ApiSchema<"WorkspaceRecentVisit">[]): TActivityEntityData[] =>
  visits.flatMap((visit) =>
    isOneOf(RECENT_ENTITY_NAMES, visit.entity_name)
      ? [{ ...visit, entity_name: visit.entity_name, entity_data: toRecentEntity(visit.entity_data) }]
      : []
  );

const workspacePath = (slug: string) => ({ path: { slug } });
const workspaceItemPath = (slug: string, pk: string) => ({ path: { slug, pk } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class WorkspaceService {
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

  async getLastActiveWorkspaceAndProjects(): Promise<TLastVisitedWorkspace> {
    return unwrap(apiClient.GET("/api/users/last-visited-workspace/"));
  }

  async userWorkspaceInvitations(): Promise<IWorkspaceMemberInvitation[]> {
    return unwrap(apiClient.GET("/api/users/me/workspaces/invitations/"));
  }

  async workspaceMemberMe(workspaceSlug: string): Promise<IWorkspaceMemberMe> {
    return toWorkspaceMemberMe(
      await unwrap(
        apiClient.GET("/api/workspaces/{slug}/workspace-members/me/", { params: workspacePath(workspaceSlug) })
      )
    );
  }

  async updateWorkspaceMemberMe(
    workspaceSlug: string,
    data: TWorkspaceMemberMeUpdateBody
  ): Promise<IWorkspaceMemberMe> {
    return toWorkspaceMemberMe(
      await unwrap(
        apiClient.PATCH("/api/workspaces/{slug}/workspace-members/me/", {
          params: workspacePath(workspaceSlug),
          body: data,
        })
      )
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

  async searchWorkspace(workspaceSlug: string, params: TWorkspaceSearchParams): Promise<IWorkspaceSearchResults> {
    return toWorkspaceSearchResults(
      await unwrap(
        apiClient.GET("/api/workspaces/{slug}/search/", {
          params: { path: { slug: workspaceSlug }, query: workspaceSearchQuery(params) },
        })
      )
    );
  }

  async createView(workspaceSlug: string, data: Partial<IWorkspaceView>): Promise<IWorkspaceView> {
    return toWorkspaceView(
      await unwrap(
        apiClient.POST("/api/workspaces/{slug}/views/", {
          params: workspacePath(workspaceSlug),
          body: toViewCreateBody(data),
        })
      )
    );
  }

  async updateView(workspaceSlug: string, viewId: string, data: Partial<IWorkspaceView>): Promise<IWorkspaceView> {
    return toWorkspaceView(
      await unwrap(
        apiClient.PATCH("/api/workspaces/{slug}/views/{pk}/", {
          params: workspaceItemPath(workspaceSlug, viewId),
          body: toViewUpdateBody(data),
        })
      )
    );
  }

  async deleteView(workspaceSlug: string, viewId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/views/{pk}/", { params: workspaceItemPath(workspaceSlug, viewId) })
    );
  }

  async getAllViews(workspaceSlug: string): Promise<IWorkspaceView[]> {
    const views = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/views/", { params: workspacePath(workspaceSlug) })
    );
    return views.map(toWorkspaceView);
  }

  async getViewDetails(workspaceSlug: string, viewId: string): Promise<IWorkspaceView> {
    return toWorkspaceView(
      await unwrap(
        apiClient.GET("/api/workspaces/{slug}/views/{pk}/", { params: workspaceItemPath(workspaceSlug, viewId) })
      )
    );
  }

  async getViewIssues(
    workspaceSlug: string,
    params: TIssueParamsRecord | undefined,
    options: TRequestOptions = {}
  ): Promise<TIssuesResponse> {
    const page = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/issues/", {
        params: { path: { slug: workspaceSlug }, query: toWorkspaceIssueListQuery(params) },
        ...options,
      })
    );
    return toIssuesResponse(page);
  }

  async getWorkspaceUserProjectsRole(workspaceSlug: string): Promise<IUserProjectsRole> {
    return unwrap(
      apiClient.GET("/api/users/me/workspaces/{slug}/project-roles/", { params: workspacePath(workspaceSlug) })
    );
  }

  // quicklinks
  async fetchWorkspaceLinks(workspaceSlug: string): Promise<TLink[]> {
    return unwrap(apiClient.GET("/api/workspaces/{slug}/quick-links/", { params: workspacePath(workspaceSlug) }));
  }

  async createWorkspaceLink(workspaceSlug: string, data: TWorkspaceLinkCreateBody): Promise<TLink> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/quick-links/", { params: workspacePath(workspaceSlug), body: data })
    );
  }

  async updateWorkspaceLink(workspaceSlug: string, linkId: string, data: TWorkspaceLinkUpdateBody): Promise<TLink> {
    return unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/quick-links/{pk}/", {
        params: workspaceItemPath(workspaceSlug, linkId),
        body: data,
      })
    );
  }

  async deleteWorkspaceLink(workspaceSlug: string, linkId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/quick-links/{pk}/", { params: workspaceItemPath(workspaceSlug, linkId) })
    );
  }

  async searchEntity(workspaceSlug: string, params: TSearchEntityRequestPayload): Promise<TSearchResponse> {
    const response = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/entity-search/", {
        params: {
          path: { slug: workspaceSlug },
          query: {
            query: params.query,
            query_type: params.query_type.join(","),
            count: params.count,
            project_id: params.project_id,
          },
        },
      })
    );
    return {
      ...response,
      project: response.project?.map(withParsedLogo),
      page: response.page?.map(withParsedLogo),
    };
  }

  // recents
  async fetchWorkspaceRecents(workspaceSlug: string, entity_name?: string): Promise<TActivityEntityData[]> {
    return toRecentVisits(
      await unwrap(
        apiClient.GET("/api/workspaces/{slug}/recent-visits/", {
          params: { path: { slug: workspaceSlug }, query: { entity_name } },
        })
      )
    );
  }

  // widgets
  async fetchWorkspaceWidgets(workspaceSlug: string): Promise<TWidgetEntityData[]> {
    return unwrap(apiClient.GET("/api/workspaces/{slug}/home-preferences/", { params: workspacePath(workspaceSlug) }));
  }

  async updateWorkspaceWidget(
    workspaceSlug: string,
    widgetKey: string,
    data: TWorkspaceWidgetUpdateBody
  ): Promise<TWorkspaceWidgetUpdateResponse> {
    return unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/home-preferences/{key}/", {
        params: { path: { slug: workspaceSlug, key: widgetKey } },
        body: data,
      })
    );
  }

  async fetchSidebarNavigationPreferences(workspaceSlug: string): Promise<IWorkspaceSidebarNavigation> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/sidebar-preferences/", { params: workspacePath(workspaceSlug) })
    );
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
    return toWorkspaceUserProperties(
      await unwrap(apiClient.GET("/api/workspaces/{slug}/user-properties/", { params: workspacePath(workspaceSlug) }))
    );
  }

  async patchWorkspaceFilters(
    workspaceSlug: string,
    data: Partial<IWorkspaceUserPropertiesResponse>
  ): Promise<IWorkspaceUserPropertiesResponse> {
    return toWorkspaceUserProperties(
      await unwrap(
        apiClient.PATCH("/api/workspaces/{slug}/user-properties/", { params: workspacePath(workspaceSlug), body: data })
      )
    );
  }
}
