/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unwrap } from "@plane/services";
import { parseIssueType } from "@plane/types";
import type { TIssueType } from "@plane/types";
import { apiClient } from "@/services/api-client";

export type TIssueTypeUpdateBody = Partial<
  Pick<TIssueType, "name" | "description" | "logo_props" | "is_active" | "level">
>;
export type TIssueTypeCreateBody = TIssueTypeUpdateBody & Pick<TIssueType, "name">;

/** The writable fields of a work item type. */
export const issueTypeUpdateBody = (data: Partial<TIssueType>): TIssueTypeUpdateBody => ({
  name: data.name,
  description: data.description,
  logo_props: data.logo_props,
  is_active: data.is_active,
  level: data.level,
});

export const issueTypeCreateBody = (data: Partial<TIssueType>): TIssueTypeCreateBody => {
  if (!data.name) throw new Error("A work item type needs a name");
  return { ...issueTypeUpdateBody(data), name: data.name };
};

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class IssueTypeService {
  async getProjectIssueTypes(workspaceSlug: string, projectId: string): Promise<TIssueType[]> {
    const types = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issue-types/", {
        params: { path: { slug: workspaceSlug, project_id: projectId } },
      })
    );
    return types.map(parseIssueType);
  }

  async createIssueType(workspaceSlug: string, projectId: string, data: Partial<TIssueType>): Promise<TIssueType> {
    const type = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/issue-types/", {
        params: { path: { slug: workspaceSlug, project_id: projectId } },
        body: issueTypeCreateBody(data),
      })
    );
    return parseIssueType(type);
  }

  async updateIssueType(
    workspaceSlug: string,
    projectId: string,
    issueTypeId: string,
    data: Partial<TIssueType>
  ): Promise<TIssueType> {
    const type = await unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/issue-types/{pk}/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, pk: issueTypeId } },
        body: issueTypeUpdateBody(data),
      })
    );
    return parseIssueType(type);
  }
}
