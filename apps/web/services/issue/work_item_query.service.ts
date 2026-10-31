/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unwrap } from "@plane/services";
import type { TWorkItemQueryFields, TWorkItemQueryValidation } from "@plane/types";
import { apiClient } from "@/services/api-client";

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class WorkItemQueryService {
  async validate(workspaceSlug: string, pql: string, projectId?: string): Promise<TWorkItemQueryValidation> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/work-item-query/validate/", {
        params: { path: { slug: workspaceSlug } },
        body: { pql, project_id: projectId ?? null },
      })
    );
  }

  async fields(workspaceSlug: string): Promise<TWorkItemQueryFields> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/work-item-query/fields/", { params: { path: { slug: workspaceSlug } } })
    );
  }
}
