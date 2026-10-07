/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody } from "@plane/api-types";
import { unwrap } from "@plane/services";
import type { IIntakeState, IState } from "@plane/types";
import { apiClient } from "@/services/api-client";

const projectPath = (slug: string, project_id: string) => ({ path: { slug, project_id } });
export type TStateCreateBody = ApiRequestBody<"/api/workspaces/{slug}/projects/{project_id}/states/", "post">;

const statePath = (slug: string, project_id: string, pk: string) => ({ path: { slug, project_id, pk } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class ProjectStateService {
  async createState(workspaceSlug: string, projectId: string, data: TStateCreateBody): Promise<IState> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/states/", {
        params: projectPath(workspaceSlug, projectId),
        body: data,
      })
    );
  }

  async markDefault(workspaceSlug: string, projectId: string, stateId: string): Promise<void> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/states/{pk}/mark-default/", {
        params: statePath(workspaceSlug, projectId, stateId),
      })
    );
  }

  async getStates(workspaceSlug: string, projectId: string): Promise<IState[]> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/states/", {
        params: projectPath(workspaceSlug, projectId),
      })
    );
  }

  async getIntakeState(workspaceSlug: string, projectId: string): Promise<IIntakeState> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/intake-state/", {
        params: projectPath(workspaceSlug, projectId),
      })
    );
  }

  async getState(workspaceSlug: string, projectId: string, stateId: string): Promise<IState> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/states/{pk}/", {
        params: statePath(workspaceSlug, projectId, stateId),
      })
    );
  }

  async patchState(workspaceSlug: string, projectId: string, stateId: string, data: Partial<IState>): Promise<IState> {
    return unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/states/{pk}/", {
        params: statePath(workspaceSlug, projectId, stateId),
        body: data,
      })
    );
  }

  async deleteState(workspaceSlug: string, projectId: string, stateId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/states/{pk}/", {
        params: statePath(workspaceSlug, projectId, stateId),
      })
    );
  }

  async getWorkspaceStates(workspaceSlug: string): Promise<IState[]> {
    return unwrap(apiClient.GET("/api/workspaces/{slug}/states/", { params: { path: { slug: workspaceSlug } } }));
  }
}
