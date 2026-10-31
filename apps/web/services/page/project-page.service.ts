/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import type { TDocumentPayload, TPage } from "@plane/types";
import { apiClient } from "@/services/api-client";
import { toPage, toPageCreateBody, toPageUpdateBody } from "./page-convert";

export type TPagePosition = ApiSchema<"PagePositionRequest">;
export type TPageOrder = ApiSchema<"PageOrder">;

const projectPath = (slug: string, project_id: string) => ({ path: { slug, project_id } });
const pagePath = (slug: string, project_id: string, page_id: string) => ({ path: { slug, project_id, page_id } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class ProjectPageService {
  async fetchAll(workspaceSlug: string, projectId: string): Promise<TPage[]> {
    const pages = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/pages/", {
        params: projectPath(workspaceSlug, projectId),
      })
    );
    return pages.map(toPage);
  }

  async fetchById(workspaceSlug: string, projectId: string, pageId: string, trackVisit: boolean): Promise<TPage> {
    const page = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/", {
        params: { ...pagePath(workspaceSlug, projectId, pageId), query: { track_visit: trackVisit } },
      })
    );
    return toPage(page);
  }

  async create(workspaceSlug: string, projectId: string, data: Partial<TPage>): Promise<TPage> {
    const page = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/pages/", {
        params: projectPath(workspaceSlug, projectId),
        body: toPageCreateBody(data),
      })
    );
    return toPage(page);
  }

  async update(workspaceSlug: string, projectId: string, pageId: string, data: Partial<TPage>): Promise<TPage> {
    const page = await unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/", {
        params: pagePath(workspaceSlug, projectId, pageId),
        body: toPageUpdateBody(data),
      })
    );
    return toPage(page);
  }

  /** Returns every page whose parent or sort order changed. */
  async position(workspaceSlug: string, projectId: string, pageId: string, data: TPagePosition): Promise<TPageOrder[]> {
    const response = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/position/", {
        params: pagePath(workspaceSlug, projectId, pageId),
        body: data,
      })
    );
    return response.pages;
  }

  async updateAccess(
    workspaceSlug: string,
    projectId: string,
    pageId: string,
    data: Pick<TPage, "access">
  ): Promise<void> {
    await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/access/", {
        params: pagePath(workspaceSlug, projectId, pageId),
        body: { access: data.access },
      })
    );
  }

  async remove(workspaceSlug: string, projectId: string, pageId: string): Promise<void> {
    await unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/", {
        params: pagePath(workspaceSlug, projectId, pageId),
      })
    );
  }

  async archive(workspaceSlug: string, projectId: string, pageId: string): Promise<{ archived_at: string }> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/archive/", {
        params: pagePath(workspaceSlug, projectId, pageId),
      })
    );
  }

  async restore(workspaceSlug: string, projectId: string, pageId: string): Promise<void> {
    await unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/archive/", {
        params: pagePath(workspaceSlug, projectId, pageId),
      })
    );
  }

  async lock(workspaceSlug: string, projectId: string, pageId: string): Promise<void> {
    await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/lock/", {
        params: pagePath(workspaceSlug, projectId, pageId),
      })
    );
  }

  async unlock(workspaceSlug: string, projectId: string, pageId: string): Promise<void> {
    await unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/lock/", {
        params: pagePath(workspaceSlug, projectId, pageId),
      })
    );
  }

  /** The Yjs document of the page. Empty when the page has none. */
  async fetchDescriptionBinary(workspaceSlug: string, projectId: string, pageId: string): Promise<ArrayBuffer> {
    // openapi-fetch returns no data for an empty body with Content-Length 0.
    const binary: ArrayBuffer | undefined = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/description/", {
        params: pagePath(workspaceSlug, projectId, pageId),
        parseAs: "arrayBuffer",
      })
    );
    return binary ?? new ArrayBuffer(0);
  }

  async updateDescription(
    workspaceSlug: string,
    projectId: string,
    pageId: string,
    data: TDocumentPayload
  ): Promise<void> {
    await unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/description/", {
        params: pagePath(workspaceSlug, projectId, pageId),
        body: data,
      })
    );
  }

  async duplicate(workspaceSlug: string, projectId: string, pageId: string): Promise<TPage> {
    const page = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/duplicate/", {
        params: pagePath(workspaceSlug, projectId, pageId),
      })
    );
    return toPage(page);
  }
}
