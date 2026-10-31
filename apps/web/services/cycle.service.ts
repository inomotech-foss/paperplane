/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import type {
  CycleDateCheckData,
  ICycle,
  TCycleDistribution,
  TCycleEstimateDistribution,
  TIssuesResponse,
  TProgressSnapshot,
} from "@plane/types";
import { apiClient } from "@/services/api-client";
import {
  toCycle,
  toCycleCreateBody,
  toCycleDistribution,
  toCycleEstimateSums,
  toCycleProgress,
  toCycleWriteBody,
} from "@/services/cycle-convert";
import { toIssueListQuery } from "@/services/issue/issue-query";
import type { TIssueParamsRecord } from "@/services/issue/issue-query";
import { toIssuesResponse } from "@/services/issue/work-item";

export type TCycleDateCheck = ApiSchema<"CycleDateCheck">;

const projectPath = (slug: string, project_id: string) => ({ path: { slug, project_id } });
const cyclePath = (slug: string, project_id: string, cycle_id: string) => ({ path: { slug, project_id, cycle_id } });
const cycleItemPath = (slug: string, project_id: string, pk: string) => ({ path: { slug, project_id, pk } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class CycleService {
  private async getAnalytics(workspaceSlug: string, projectId: string, cycleId: string, type: "issues" | "points") {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/analytics/", {
        params: { ...cyclePath(workspaceSlug, projectId, cycleId), query: { type } },
      })
    );
  }

  async getCycleDistribution(workspaceSlug: string, projectId: string, cycleId: string): Promise<TCycleDistribution> {
    return toCycleDistribution(await this.getAnalytics(workspaceSlug, projectId, cycleId, "issues"));
  }

  async getCycleEstimateDistribution(
    workspaceSlug: string,
    projectId: string,
    cycleId: string
  ): Promise<TCycleEstimateDistribution> {
    return toCycleEstimateSums(await this.getAnalytics(workspaceSlug, projectId, cycleId, "points"));
  }

  async getCycleProgress(workspaceSlug: string, projectId: string, cycleId: string): Promise<TProgressSnapshot> {
    const progress = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/progress/", {
        params: cyclePath(workspaceSlug, projectId, cycleId),
      })
    );
    return toCycleProgress(progress);
  }

  async getWorkspaceCycles(workspaceSlug: string): Promise<ICycle[]> {
    const cycles = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/cycles/", { params: { path: { slug: workspaceSlug } } })
    );
    return cycles.map(toCycle);
  }

  async createCycle(workspaceSlug: string, projectId: string, data: Partial<ICycle>): Promise<ICycle> {
    const cycle = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/cycles/", {
        params: projectPath(workspaceSlug, projectId),
        body: toCycleCreateBody(data),
      })
    );
    return toCycle(cycle);
  }

  async getCyclesWithParams(workspaceSlug: string, projectId: string, cycleType?: "current"): Promise<ICycle[]> {
    const cycles = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/cycles/", {
        params: { ...projectPath(workspaceSlug, projectId), query: { cycle_view: cycleType } },
      })
    );
    return cycles.map(toCycle);
  }

  async getCycleDetails(workspaceSlug: string, projectId: string, cycleId: string): Promise<ICycle> {
    const cycle = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/cycles/{pk}/", {
        params: cycleItemPath(workspaceSlug, projectId, cycleId),
      })
    );
    return toCycle(cycle);
  }

  async getCycleIssues(
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
    queries?: TIssueParamsRecord
  ): Promise<TIssuesResponse> {
    const page = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/cycle-issues/", {
        params: { ...cyclePath(workspaceSlug, projectId, cycleId), query: toIssueListQuery(queries) },
      })
    );
    return toIssuesResponse(page);
  }

  async patchCycle(workspaceSlug: string, projectId: string, cycleId: string, data: Partial<ICycle>): Promise<ICycle> {
    const cycle = await unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/cycles/{pk}/", {
        params: cycleItemPath(workspaceSlug, projectId, cycleId),
        body: toCycleWriteBody(data),
      })
    );
    return toCycle(cycle);
  }

  async deleteCycle(workspaceSlug: string, projectId: string, cycleId: string): Promise<void> {
    await unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/cycles/{pk}/", {
        params: cycleItemPath(workspaceSlug, projectId, cycleId),
      })
    );
  }

  async cycleDateCheck(workspaceSlug: string, projectId: string, data: CycleDateCheckData): Promise<TCycleDateCheck> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/cycles/date-check/", {
        params: projectPath(workspaceSlug, projectId),
        body: data,
      })
    );
  }

  async transferIssues(
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
    data: { new_cycle_id: string }
  ): Promise<void> {
    await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/transfer-issues/", {
        params: cyclePath(workspaceSlug, projectId, cycleId),
        body: data,
      })
    );
  }

  async addIssuesToCycle(workspaceSlug: string, projectId: string, cycleId: string, issueIds: string[]): Promise<void> {
    await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/cycle-issues/", {
        params: cyclePath(workspaceSlug, projectId, cycleId),
        body: { issues: issueIds },
      })
    );
  }

  async removeIssueFromCycle(
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
    issueId: string
  ): Promise<void> {
    await unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/cycles/{cycle_id}/cycle-issues/{issue_id}/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, cycle_id: cycleId, issue_id: issueId } },
      })
    );
  }
}
