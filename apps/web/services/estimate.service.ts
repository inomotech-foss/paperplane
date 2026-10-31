/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody, ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import { EEstimateSystem } from "@plane/types";
import type { IEstimate, IEstimateFormData, IEstimatePoint, TEstimateSystemKeys, TEstimateType } from "@plane/types";
import { apiClient } from "@/services/api-client";

export type TEstimateCreateBody = ApiRequestBody<"/api/workspaces/{slug}/projects/{project_id}/estimates/", "post">;
export type TEstimatePointCreateBody = ApiRequestBody<
  "/api/workspaces/{slug}/projects/{project_id}/estimates/{estimate_id}/estimate-points/",
  "post"
>;
export type TEstimatePointUpdateBody = ApiRequestBody<
  "/api/workspaces/{slug}/projects/{project_id}/estimates/{estimate_id}/estimate-points/{estimate_point_id}/",
  "patch"
>;

/** The API stores no time estimates. */
export const toEstimateType = (system: TEstimateSystemKeys): TEstimateType | undefined => {
  switch (system) {
    case EEstimateSystem.POINTS:
      return "points";
    case EEstimateSystem.CATEGORIES:
      return "categories";
    default:
      return undefined;
  }
};

const isEstimateType = (type: string | undefined): type is TEstimateType => type === "points" || type === "categories";

/** The create body. A type the API does not store falls back to the API default. */
export const estimateCreateBody = (data: IEstimateFormData): TEstimateCreateBody => {
  const { type, ...estimate } = data.estimate ?? {};
  return {
    estimate: isEstimateType(type) ? { ...estimate, type } : estimate,
    estimate_points: data.estimate_points.map(({ key, value }) => ({ key, value })),
  };
};

export const toEstimateSystem = (type: TEstimateType): TEstimateSystemKeys =>
  type === "points" ? EEstimateSystem.POINTS : EEstimateSystem.CATEGORIES;

const toEstimate = (estimate: ApiSchema<"EstimateRead">): IEstimate => ({
  ...estimate,
  type: toEstimateSystem(estimate.type),
});

const projectPath = (slug: string, project_id: string) => ({ path: { slug, project_id } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class EstimateService {
  async fetchWorkspaceEstimates(workspaceSlug: string): Promise<IEstimate[]> {
    const estimates = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/estimates/", { params: { path: { slug: workspaceSlug } } })
    );
    return estimates.map(toEstimate);
  }

  async fetchProjectEstimates(workspaceSlug: string, projectId: string): Promise<IEstimate[]> {
    const estimates = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/estimates/", {
        params: projectPath(workspaceSlug, projectId),
      })
    );
    return estimates.map(toEstimate);
  }

  async fetchEstimateById(workspaceSlug: string, projectId: string, estimateId: string): Promise<IEstimate> {
    const estimate = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/estimates/{estimate_id}/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, estimate_id: estimateId } },
      })
    );
    return toEstimate(estimate);
  }

  async createEstimate(workspaceSlug: string, projectId: string, payload: IEstimateFormData): Promise<IEstimate> {
    const estimate = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/estimates/", {
        params: projectPath(workspaceSlug, projectId),
        body: estimateCreateBody(payload),
      })
    );
    return toEstimate(estimate);
  }

  async deleteEstimate(workspaceSlug: string, projectId: string, estimateId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/estimates/{estimate_id}/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, estimate_id: estimateId } },
      })
    );
  }

  async createEstimatePoint(
    workspaceSlug: string,
    projectId: string,
    estimateId: string,
    payload: TEstimatePointCreateBody
  ): Promise<IEstimatePoint> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/estimates/{estimate_id}/estimate-points/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, estimate_id: estimateId } },
        body: payload,
      })
    );
  }

  async updateEstimatePoint(
    workspaceSlug: string,
    projectId: string,
    estimateId: string,
    estimatePointId: string,
    payload: TEstimatePointUpdateBody
  ): Promise<IEstimatePoint> {
    return unwrap(
      apiClient.PATCH(
        "/api/workspaces/{slug}/projects/{project_id}/estimates/{estimate_id}/estimate-points/{estimate_point_id}/",
        {
          params: {
            path: {
              slug: workspaceSlug,
              project_id: projectId,
              estimate_id: estimateId,
              estimate_point_id: estimatePointId,
            },
          },
          body: payload,
        }
      )
    );
  }
}

const estimateService = new EstimateService();

export default estimateService;
