/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unwrap } from "@plane/services";
import { parseIssueFiltersResponse } from "@plane/types";
import type { IIssueFiltersResponse } from "@plane/types";
import { apiClient } from "@/services/api-client";

/** Omitted keys keep their stored value. */
export type TIssueFiltersUpdate = Partial<IIssueFiltersResponse>;

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class IssueFiltersService {
  async fetchCycleIssueFilters(
    workspaceSlug: string,
    projectId: string,
    cycleId: string
  ): Promise<IIssueFiltersResponse> {
    const properties = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/user-properties/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, cycle_id: cycleId } },
      })
    );
    return parseIssueFiltersResponse(properties);
  }

  async patchCycleIssueFilters(
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
    data: TIssueFiltersUpdate
  ): Promise<IIssueFiltersResponse> {
    const properties = await unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/user-properties/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, cycle_id: cycleId } },
        body: data,
      })
    );
    return parseIssueFiltersResponse(properties);
  }

  async fetchModuleIssueFilters(
    workspaceSlug: string,
    projectId: string,
    moduleId: string
  ): Promise<IIssueFiltersResponse> {
    const properties = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/modules/{module_id}/user-properties/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, module_id: moduleId } },
      })
    );
    return parseIssueFiltersResponse(properties);
  }

  async patchModuleIssueFilters(
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    data: TIssueFiltersUpdate
  ): Promise<IIssueFiltersResponse> {
    const properties = await unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/modules/{module_id}/user-properties/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, module_id: moduleId } },
        body: data,
      })
    );
    return parseIssueFiltersResponse(properties);
  }
}
