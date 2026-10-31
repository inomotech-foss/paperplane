// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ApiRequestBody } from "@plane/api-types";
import { unwrap } from "@plane/services";
import type { TProjectSidebarLink, TProjectSidebarLinkPayload } from "@plane/types";
import { apiClient } from "@/services/api-client";

export type TProjectLinkUpdateBody = ApiRequestBody<
  "/api/workspaces/{slug}/projects/{project_id}/links/{pk}/",
  "patch"
>;

const projectPath = (slug: string, project_id: string) => ({ path: { slug, project_id } });
const linkPath = (slug: string, project_id: string, pk: string) => ({ path: { slug, project_id, pk } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class ProjectLinkService {
  async listWorkspaceLinks(workspaceSlug: string): Promise<TProjectSidebarLink[]> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/project-links/", { params: { path: { slug: workspaceSlug } } })
    );
  }

  async list(workspaceSlug: string, projectId: string): Promise<TProjectSidebarLink[]> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/links/", {
        params: projectPath(workspaceSlug, projectId),
      })
    );
  }

  async create(
    workspaceSlug: string,
    projectId: string,
    data: TProjectSidebarLinkPayload
  ): Promise<TProjectSidebarLink> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/links/", {
        params: projectPath(workspaceSlug, projectId),
        body: data,
      })
    );
  }

  async update(
    workspaceSlug: string,
    projectId: string,
    linkId: string,
    data: TProjectLinkUpdateBody
  ): Promise<TProjectSidebarLink> {
    return unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/links/{pk}/", {
        params: linkPath(workspaceSlug, projectId, linkId),
        body: data,
      })
    );
  }

  async remove(workspaceSlug: string, projectId: string, linkId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/links/{pk}/", {
        params: linkPath(workspaceSlug, projectId, linkId),
      })
    );
  }

  async reorder(workspaceSlug: string, projectId: string, linkIds: string[]): Promise<TProjectSidebarLink[]> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/links/reorder/", {
        params: projectPath(workspaceSlug, projectId),
        body: { link_ids: linkIds },
      })
    );
  }
}
