/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unwrap } from "@plane/services";
import type { ILinkDetails, IModule } from "@plane/types";
import { apiClient } from "@/services/api-client";
import {
  toModule,
  toModuleCreateBody,
  toModuleLink,
  toModuleLinkBody,
  toModuleUpdateBody,
} from "@/services/module-convert";

const projectPath = (slug: string, project_id: string) => ({ path: { slug, project_id } });
const moduleItemPath = (slug: string, project_id: string, pk: string) => ({ path: { slug, project_id, pk } });
const modulePath = (slug: string, project_id: string, module_id: string) => ({
  path: { slug, project_id, module_id },
});

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class ModuleService {
  async getWorkspaceModules(workspaceSlug: string): Promise<IModule[]> {
    const modules = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/modules/", { params: { path: { slug: workspaceSlug } } })
    );
    return modules.map(toModule);
  }

  async getModules(workspaceSlug: string, projectId: string): Promise<IModule[]> {
    const modules = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/modules/", {
        params: projectPath(workspaceSlug, projectId),
      })
    );
    return modules.map(toModule);
  }

  async createModule(workspaceSlug: string, projectId: string, data: Partial<IModule>): Promise<IModule> {
    const module = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/modules/", {
        params: projectPath(workspaceSlug, projectId),
        body: toModuleCreateBody(data),
      })
    );
    return toModule(module);
  }

  async getModuleDetails(workspaceSlug: string, projectId: string, moduleId: string): Promise<IModule> {
    const module = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/modules/{pk}/", {
        params: moduleItemPath(workspaceSlug, projectId, moduleId),
      })
    );
    return toModule(module);
  }

  async patchModule(
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    data: Partial<IModule>
  ): Promise<IModule> {
    const module = await unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/modules/{pk}/", {
        params: moduleItemPath(workspaceSlug, projectId, moduleId),
        body: toModuleUpdateBody(data),
      })
    );
    return toModule(module);
  }

  async deleteModule(workspaceSlug: string, projectId: string, moduleId: string): Promise<void> {
    await unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/modules/{pk}/", {
        params: moduleItemPath(workspaceSlug, projectId, moduleId),
      })
    );
  }

  async addIssuesToModule(
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    data: { issues: string[] }
  ): Promise<void> {
    await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/modules/{module_id}/issues/", {
        params: modulePath(workspaceSlug, projectId, moduleId),
        body: data,
      })
    );
  }

  async addModulesToIssue(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: { modules: string[]; removed_modules?: string[] }
  ): Promise<void> {
    await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/modules/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, issue_id: issueId } },
        body: data,
      })
    );
  }

  async removeIssuesFromModuleBulk(
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    issueIds: string[]
  ): Promise<void> {
    await Promise.all(
      issueIds.map((issueId) =>
        unwrap(
          apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/modules/{module_id}/issues/{issue_id}/", {
            params: { path: { slug: workspaceSlug, project_id: projectId, module_id: moduleId, issue_id: issueId } },
          })
        )
      )
    );
  }

  async createModuleLink(
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    data: Partial<ILinkDetails>
  ): Promise<ILinkDetails> {
    const link = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/modules/{module_id}/module-links/", {
        params: modulePath(workspaceSlug, projectId, moduleId),
        body: toModuleLinkBody(data),
      })
    );
    return toModuleLink(link);
  }

  async updateModuleLink(
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    linkId: string,
    data: Partial<ILinkDetails>
  ): Promise<ILinkDetails> {
    const link = await unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/modules/{module_id}/module-links/{pk}/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, module_id: moduleId, pk: linkId } },
        body: { title: data.title, url: data.url },
      })
    );
    return toModuleLink(link);
  }

  async deleteModuleLink(workspaceSlug: string, projectId: string, moduleId: string, linkId: string): Promise<void> {
    await unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/modules/{module_id}/module-links/{pk}/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, module_id: moduleId, pk: linkId } },
      })
    );
  }
}
