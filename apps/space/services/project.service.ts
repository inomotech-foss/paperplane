/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiResponse } from "@plane/api-types";
import { unwrap } from "@plane/services";
import { apiClient } from "@/services/api-client";

export type TPublishSettingsResponse = ApiResponse<"/api/public/anchor/{anchor}/settings/", "get">;
export type TPublicCycle = ApiResponse<"/api/public/anchor/{anchor}/cycles/", "get">[number];
export type TPublicLabel = ApiResponse<"/api/public/anchor/{anchor}/labels/", "get">[number];
export type TPublicMember = ApiResponse<"/api/public/anchor/{anchor}/members/", "get">[number];
export type TPublicModule = ApiResponse<"/api/public/anchor/{anchor}/modules/", "get">[number];
export type TPublicStateResponse = ApiResponse<"/api/public/anchor/{anchor}/states/", "get">[number];

const anchorPath = (anchor: string) => ({ params: { path: { anchor } } });

/** The published project and its entities. Errors are thrown as `ApiError` from `@plane/services`. */
export class PublicProjectService {
  async retrieveSettingsByAnchor(anchor: string): Promise<TPublishSettingsResponse> {
    return unwrap(apiClient.GET("/api/public/anchor/{anchor}/settings/", anchorPath(anchor)));
  }

  async retrieveSettingsByProjectId(workspaceSlug: string, projectId: string): Promise<TPublishSettingsResponse> {
    return unwrap(
      apiClient.GET("/api/public/workspaces/{slug}/projects/{project_id}/anchor/", {
        params: { path: { slug: workspaceSlug, project_id: projectId } },
      })
    );
  }

  async listCycles(anchor: string): Promise<TPublicCycle[]> {
    return unwrap(apiClient.GET("/api/public/anchor/{anchor}/cycles/", anchorPath(anchor)));
  }

  async listLabels(anchor: string): Promise<TPublicLabel[]> {
    return unwrap(apiClient.GET("/api/public/anchor/{anchor}/labels/", anchorPath(anchor)));
  }

  async listMembers(anchor: string): Promise<TPublicMember[]> {
    return unwrap(apiClient.GET("/api/public/anchor/{anchor}/members/", anchorPath(anchor)));
  }

  async listModules(anchor: string): Promise<TPublicModule[]> {
    return unwrap(apiClient.GET("/api/public/anchor/{anchor}/modules/", anchorPath(anchor)));
  }

  async listStates(anchor: string): Promise<TPublicStateResponse[]> {
    return unwrap(apiClient.GET("/api/public/anchor/{anchor}/states/", anchorPath(anchor)));
  }
}
