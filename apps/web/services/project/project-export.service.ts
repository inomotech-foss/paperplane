/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody, ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import { apiClient } from "@/services/api-client";

export type TIssueExportBody = ApiRequestBody<"/api/workspaces/{slug}/export-issues/", "post">;

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class ProjectExportService {
  async csvExport(workspaceSlug: string, data: TIssueExportBody): Promise<ApiSchema<"MessageResponse">> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/export-issues/", { params: { path: { slug: workspaceSlug } }, body: data })
    );
  }
}
