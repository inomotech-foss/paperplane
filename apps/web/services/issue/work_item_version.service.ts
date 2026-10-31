/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unwrap } from "@plane/services";
import type { TDescriptionVersionsListResponse, TDescriptionVersionDetails } from "@plane/types";
import { apiClient } from "@/services/api-client";

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class WorkItemVersionService {
  async listDescriptionVersions(
    workspaceSlug: string,
    projectId: string,
    workItemId: string
  ): Promise<TDescriptionVersionsListResponse> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/work-items/{work_item_id}/description-versions/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, work_item_id: workItemId } },
      })
    );
  }

  async retrieveDescriptionVersion(
    workspaceSlug: string,
    projectId: string,
    workItemId: string,
    versionId: string
  ): Promise<TDescriptionVersionDetails> {
    return unwrap(
      apiClient.GET(
        "/api/workspaces/{slug}/projects/{project_id}/work-items/{work_item_id}/description-versions/{pk}/",
        { params: { path: { slug: workspaceSlug, project_id: projectId, work_item_id: workItemId, pk: versionId } } }
      )
    );
  }
}
