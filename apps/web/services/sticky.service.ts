/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody, ApiSchema } from "@plane/api-types";
import { STICKIES_PER_PAGE } from "@plane/constants";
import { unwrap } from "@plane/services";
import { parseLogoProps } from "@plane/types";
import type { TPaginationInfo, TSticky } from "@plane/types";
import { apiClient } from "@/services/api-client";

export type TStickyBody = ApiRequestBody<"/api/workspaces/{slug}/stickies/{pk}/", "patch">;
export type TStickyPage = TPaginationInfo & { results: TSticky[] };

export function toSticky(row: ApiSchema<"Sticky">): TSticky {
  const sticky: TSticky = {
    id: row.id,
    workspace: row.workspace,
    description_html: row.description_html,
    background_color: row.background_color,
    logo_props: parseLogoProps(row.logo_props),
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (row.name !== null) sticky.name = row.name;
  if (row.created_by !== null) sticky.created_by = row.created_by;
  if (row.updated_by !== null) sticky.updated_by = row.updated_by;
  return sticky;
}

export const toStickyBody = (data: Partial<TSticky>): TStickyBody => ({
  name: data.name,
  description_html: data.description_html,
  background_color: data.background_color,
  logo_props: data.logo_props,
  sort_order: data.sort_order,
});

const workspacePath = (slug: string) => ({ path: { slug } });
const stickyPath = (slug: string, pk: string) => ({ path: { slug, pk } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class StickyService {
  async createSticky(workspaceSlug: string, payload: Partial<TSticky>): Promise<TSticky> {
    return toSticky(
      await unwrap(
        apiClient.POST("/api/workspaces/{slug}/stickies/", {
          params: workspacePath(workspaceSlug),
          body: toStickyBody(payload),
        })
      )
    );
  }

  async getStickies(workspaceSlug: string, cursor: string, query?: string, per_page?: number): Promise<TStickyPage> {
    const { results, ...page } = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/stickies/", {
        params: {
          path: { slug: workspaceSlug },
          query: { cursor, per_page: per_page || STICKIES_PER_PAGE, query: query || undefined },
        },
      })
    );
    return {
      count: page.count,
      extra_stats: page.extra_stats,
      next_cursor: page.next_cursor,
      next_page_results: page.next_page_results,
      prev_cursor: page.prev_cursor,
      prev_page_results: page.prev_page_results,
      total_pages: page.total_pages,
      total_results: page.total_results,
      results: results.map(toSticky),
    };
  }

  async updateSticky(workspaceSlug: string, id: string, data: Partial<TSticky>): Promise<TSticky> {
    return toSticky(
      await unwrap(
        apiClient.PATCH("/api/workspaces/{slug}/stickies/{pk}/", {
          params: stickyPath(workspaceSlug, id),
          body: toStickyBody(data),
        })
      )
    );
  }

  async deleteSticky(workspaceSlug: string, id: string): Promise<void> {
    return unwrap(apiClient.DELETE("/api/workspaces/{slug}/stickies/{pk}/", { params: stickyPath(workspaceSlug, id) }));
  }
}
