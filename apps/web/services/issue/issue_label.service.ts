/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody } from "@plane/api-types";
import { unwrap } from "@plane/services";
import type { IIssueLabel } from "@plane/types";
import { apiClient } from "@/services/api-client";

export type TLabelCreateBody = ApiRequestBody<"/api/workspaces/{slug}/projects/{project_id}/issue-labels/", "post">;
export type TLabelUpdateBody = ApiRequestBody<
  "/api/workspaces/{slug}/projects/{project_id}/issue-labels/{pk}/",
  "patch"
>;

/** The writable fields of a label. */
export const labelUpdateBody = (data: Partial<IIssueLabel>): TLabelUpdateBody => ({
  name: data.name,
  color: data.color,
  parent: data.parent,
  sort_order: data.sort_order,
});

export const labelCreateBody = (data: Partial<IIssueLabel>): TLabelCreateBody => {
  if (!data.name) throw new Error("A label needs a name");
  return { ...labelUpdateBody(data), name: data.name };
};

const labelPath = (slug: string, project_id: string, pk: string) => ({ path: { slug, project_id, pk } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class IssueLabelService {
  async getWorkspaceIssueLabels(workspaceSlug: string): Promise<IIssueLabel[]> {
    return unwrap(apiClient.GET("/api/workspaces/{slug}/labels/", { params: { path: { slug: workspaceSlug } } }));
  }

  async getProjectLabels(workspaceSlug: string, projectId: string): Promise<IIssueLabel[]> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issue-labels/", {
        params: { path: { slug: workspaceSlug, project_id: projectId } },
      })
    );
  }

  async createIssueLabel(workspaceSlug: string, projectId: string, data: Partial<IIssueLabel>): Promise<IIssueLabel> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/issue-labels/", {
        params: { path: { slug: workspaceSlug, project_id: projectId } },
        body: labelCreateBody(data),
      })
    );
  }

  async patchIssueLabel(
    workspaceSlug: string,
    projectId: string,
    labelId: string,
    data: Partial<IIssueLabel>
  ): Promise<IIssueLabel> {
    return unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/issue-labels/{pk}/", {
        params: labelPath(workspaceSlug, projectId, labelId),
        body: labelUpdateBody(data),
      })
    );
  }

  async deleteIssueLabel(workspaceSlug: string, projectId: string, labelId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/issue-labels/{pk}/", {
        params: labelPath(workspaceSlug, projectId, labelId),
      })
    );
  }
}
