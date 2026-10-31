/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unwrap } from "@plane/services";
import type { TDescriptionVersionsListResponse, TDescriptionVersionDetails } from "@plane/types";
import { apiClient } from "@/services/api-client";

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class IntakeWorkItemVersionService {
  async listDescriptionVersions(
    workspaceSlug: string,
    projectId: string,
    intakeWorkItemId: string
  ): Promise<TDescriptionVersionsListResponse> {
    return unwrap(
      apiClient.GET(
        "/api/workspaces/{slug}/projects/{project_id}/intake-work-items/{work_item_id}/description-versions/",
        { params: { path: { slug: workspaceSlug, project_id: projectId, work_item_id: intakeWorkItemId } } }
      )
    );
  }

  async retrieveDescriptionVersion(
    workspaceSlug: string,
    projectId: string,
    intakeWorkItemId: string,
    versionId: string
  ): Promise<TDescriptionVersionDetails> {
    return unwrap(
      apiClient.GET(
        "/api/workspaces/{slug}/projects/{project_id}/intake-work-items/{work_item_id}/description-versions/{pk}/",
        {
          params: {
            path: { slug: workspaceSlug, project_id: projectId, work_item_id: intakeWorkItemId, pk: versionId },
          },
        }
      )
    );
  }
}
