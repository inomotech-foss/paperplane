/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unwrap } from "@plane/services";
import type { IModule } from "@plane/types";
import { apiClient } from "@/services/api-client";
import { toModule } from "@/services/module-convert";

const modulePath = (slug: string, project_id: string, module_id: string) => ({
  path: { slug, project_id, module_id },
});

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class ModuleArchiveService {
  async getArchivedModules(workspaceSlug: string, projectId: string): Promise<IModule[]> {
    const modules = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/archived-modules/", {
        params: { path: { slug: workspaceSlug, project_id: projectId } },
      })
    );
    return modules.map(toModule);
  }

  async getArchivedModuleDetails(workspaceSlug: string, projectId: string, moduleId: string): Promise<IModule> {
    const module = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/archived-modules/{pk}/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, pk: moduleId } },
      })
    );
    return toModule(module);
  }

  async archiveModule(workspaceSlug: string, projectId: string, moduleId: string): Promise<{ archived_at: string }> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/modules/{module_id}/archive/", {
        params: modulePath(workspaceSlug, projectId, moduleId),
      })
    );
  }

  async restoreModule(workspaceSlug: string, projectId: string, moduleId: string): Promise<void> {
    await unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/modules/{module_id}/archive/", {
        params: modulePath(workspaceSlug, projectId, moduleId),
      })
    );
  }
}
