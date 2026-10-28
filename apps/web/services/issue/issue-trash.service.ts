/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import { apiClient } from "@/services/api-client";

export type TTrashedIssue = ApiSchema<"TrashedIssue">;
export type TTrashedIssuePage = ApiSchema<"PaginatedTrashedIssueList">;

const projectPath = (slug: string, project_id: string) => ({ path: { slug, project_id } });
const issuePath = (slug: string, project_id: string, pk: string) => ({ path: { slug, project_id, pk } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class IssueTrashService {
  async list(workspaceSlug: string, projectId: string, cursor?: string): Promise<TTrashedIssuePage> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/trash/issues/", {
        params: { ...projectPath(workspaceSlug, projectId), query: cursor ? { cursor } : undefined },
      })
    );
  }

  async restore(workspaceSlug: string, projectId: string, issueId: string): Promise<void> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/trash/issues/{pk}/restore/", {
        params: issuePath(workspaceSlug, projectId, issueId),
      })
    );
  }

  async purge(workspaceSlug: string, projectId: string, issueId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/trash/issues/{pk}/", {
        params: issuePath(workspaceSlug, projectId, issueId),
      })
    );
  }
}
