/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unwrap } from "@plane/services";
import type { TPageVersion } from "@plane/types";
import { apiClient } from "@/services/api-client";
import { toPageVersion } from "./page-convert";

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class ProjectPageVersionService {
  async fetchAllVersions(workspaceSlug: string, projectId: string, pageId: string): Promise<TPageVersion[]> {
    const versions = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/versions/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, page_id: pageId } },
      })
    );
    return versions.map(toPageVersion);
  }

  async fetchVersionById(
    workspaceSlug: string,
    projectId: string,
    pageId: string,
    versionId: string
  ): Promise<TPageVersion> {
    const version = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/pages/{page_id}/versions/{pk}/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, page_id: pageId, pk: versionId } },
      })
    );
    return toPageVersion(version);
  }
}
