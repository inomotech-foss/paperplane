/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody, ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import type { IExportServiceResponse } from "@plane/types";
import { apiClient } from "@/services/api-client";

export type TIssueExportBody = ApiRequestBody<"/api/workspaces/{slug}/export-issues/", "post">;

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class ProjectExportService {
  async csvExport(workspaceSlug: string, data: TIssueExportBody): Promise<ApiSchema<"MessageResponse">> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/export-issues/", { params: { path: { slug: workspaceSlug } }, body: data })
    );
  }

  /** The workspace export history, newest first. */
  async getExports(workspaceSlug: string, cursor: string, perPage: number): Promise<IExportServiceResponse> {
    const page = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/export-issues/", {
        params: { path: { slug: workspaceSlug }, query: { cursor, per_page: perPage } },
      })
    );
    return {
      count: page.count,
      extra_stats: page.extra_stats,
      next_cursor: page.next_cursor,
      next_page_results: page.next_page_results,
      prev_cursor: page.prev_cursor,
      prev_page_results: page.prev_page_results,
      results: page.results,
      total_pages: page.total_pages,
    };
  }
}
