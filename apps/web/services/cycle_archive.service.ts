/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unwrap } from "@plane/services";
import type { ICycle } from "@plane/types";
import { apiClient } from "@/services/api-client";
import { toCycle } from "@/services/cycle-convert";

const cyclePath = (slug: string, project_id: string, cycle_id: string) => ({ path: { slug, project_id, cycle_id } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class CycleArchiveService {
  async getArchivedCycles(workspaceSlug: string, projectId: string): Promise<ICycle[]> {
    const cycles = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/archived-cycles/", {
        params: { path: { slug: workspaceSlug, project_id: projectId } },
      })
    );
    return cycles.map(toCycle);
  }

  async getArchivedCycleDetails(workspaceSlug: string, projectId: string, cycleId: string): Promise<ICycle> {
    const cycle = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/archived-cycles/{pk}/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, pk: cycleId } },
      })
    );
    return toCycle(cycle);
  }

  async archiveCycle(workspaceSlug: string, projectId: string, cycleId: string): Promise<{ archived_at: string }> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/archive/", {
        params: cyclePath(workspaceSlug, projectId, cycleId),
      })
    );
  }

  async restoreCycle(workspaceSlug: string, projectId: string, cycleId: string): Promise<void> {
    await unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/archive/", {
        params: cyclePath(workspaceSlug, projectId, cycleId),
      })
    );
  }
}
