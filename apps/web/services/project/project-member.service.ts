/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody, ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import type { TProjectMembership } from "@plane/types";
import { apiClient } from "@/services/api-client";

export type TProjectMembersAddBody = ApiRequestBody<"/api/workspaces/{slug}/projects/{project_id}/members/", "post">;
export type TProjectMemberUpdateBody = ApiRequestBody<
  "/api/workspaces/{slug}/projects/{project_id}/members/{pk}/",
  "patch"
>;
export type TProjectMemberMe = Omit<ApiSchema<"ProjectMember">, "view_props" | "default_props" | "preferences">;

/** Leaves out rows whose user is gone, which have no member to key them by. */
export const toMemberships = (rows: ApiSchema<"ProjectMemberRole">[]): TProjectMembership[] =>
  rows.flatMap(({ member, ...row }) => (member ? [{ ...row, member }] : []));

const projectPath = (slug: string, project_id: string) => ({ path: { slug, project_id } });
const memberPath = (slug: string, project_id: string, pk: string) => ({ path: { slug, project_id, pk } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class ProjectMemberService {
  async fetchProjectMembers(workspaceSlug: string, projectId: string): Promise<TProjectMembership[]> {
    return toMemberships(
      await unwrap(
        apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/members/", {
          params: projectPath(workspaceSlug, projectId),
        })
      )
    );
  }

  async bulkAddMembersToProject(
    workspaceSlug: string,
    projectId: string,
    data: TProjectMembersAddBody
  ): Promise<TProjectMembership[]> {
    return toMemberships(
      await unwrap(
        apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/members/", {
          params: projectPath(workspaceSlug, projectId),
          body: data,
        })
      )
    );
  }

  async projectMemberMe(workspaceSlug: string, projectId: string): Promise<TProjectMemberMe> {
    const {
      view_props: _viewProps,
      default_props: _defaultProps,
      preferences: _preferences,
      ...member
    } = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/project-members/me/", {
        params: projectPath(workspaceSlug, projectId),
      })
    );
    return member;
  }

  async updateProjectMember(
    workspaceSlug: string,
    projectId: string,
    memberId: string,
    data: TProjectMemberUpdateBody
  ): Promise<void> {
    await unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/members/{pk}/", {
        params: memberPath(workspaceSlug, projectId, memberId),
        body: data,
      })
    );
  }

  async deleteProjectMember(workspaceSlug: string, projectId: string, memberId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/members/{pk}/", {
        params: memberPath(workspaceSlug, projectId, memberId),
      })
    );
  }
}

const projectMemberService = new ProjectMemberService();

export default projectMemberService;
