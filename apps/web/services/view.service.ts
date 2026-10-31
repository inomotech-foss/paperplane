/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unwrap } from "@plane/services";
import type { IProjectView } from "@plane/types";
import { apiClient } from "@/services/api-client";
import { toProjectView, toViewCreateBody, toViewUpdateBody } from "@/services/view-convert";

const projectPath = (slug: string, project_id: string) => ({ path: { slug, project_id } });
const viewPath = (slug: string, project_id: string, pk: string) => ({ path: { slug, project_id, pk } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class ViewService {
  async createView(workspaceSlug: string, projectId: string, data: Partial<IProjectView>): Promise<IProjectView> {
    const view = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/views/", {
        params: projectPath(workspaceSlug, projectId),
        body: toViewCreateBody(data),
      })
    );
    return toProjectView(view, projectId);
  }

  async patchView(
    workspaceSlug: string,
    projectId: string,
    viewId: string,
    data: Partial<IProjectView>
  ): Promise<IProjectView> {
    const view = await unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/views/{pk}/", {
        params: viewPath(workspaceSlug, projectId, viewId),
        body: toViewUpdateBody(data),
      })
    );
    return toProjectView(view, projectId);
  }

  async deleteView(workspaceSlug: string, projectId: string, viewId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/views/{pk}/", {
        params: viewPath(workspaceSlug, projectId, viewId),
      })
    );
  }

  async getViews(workspaceSlug: string, projectId: string): Promise<IProjectView[]> {
    const views = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/views/", {
        params: projectPath(workspaceSlug, projectId),
      })
    );
    return views.map((view) => toProjectView(view, projectId));
  }

  async getViewDetails(workspaceSlug: string, projectId: string, viewId: string): Promise<IProjectView> {
    const view = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/views/{pk}/", {
        params: viewPath(workspaceSlug, projectId, viewId),
      })
    );
    return toProjectView(view, projectId);
  }
}
