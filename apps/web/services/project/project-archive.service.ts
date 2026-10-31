/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import { apiClient } from "@/services/api-client";

const projectPath = (slug: string, project_id: string) => ({ path: { slug, project_id } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class ProjectArchiveService {
  async archiveProject(workspaceSlug: string, projectId: string): Promise<ApiSchema<"ProjectArchive">> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/archive/", {
        params: projectPath(workspaceSlug, projectId),
      })
    );
  }

  async restoreProject(workspaceSlug: string, projectId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/archive/", {
        params: projectPath(workspaceSlug, projectId),
      })
    );
  }
}
