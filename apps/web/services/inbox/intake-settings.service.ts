// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ApiResponse } from "@plane/api-types";
import { unwrap } from "@plane/services";
import { apiClient } from "@/services/api-client";

export type TIntake = ApiResponse<"/api/workspaces/{slug}/projects/{project_id}/intakes/", "get">;

/** The project's intake and its settings. Errors are thrown as `ApiError` from `@plane/services`. */
export class IntakeSettingsService {
  async getIntake(workspaceSlug: string, projectId: string): Promise<TIntake> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/intakes/", {
        params: { path: { slug: workspaceSlug, project_id: projectId } },
      })
    );
  }

  async setIssueType(
    workspaceSlug: string,
    projectId: string,
    intakeId: string,
    issueTypeId: string
  ): Promise<TIntake> {
    return unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/intakes/{pk}/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, pk: intakeId } },
        body: { issue_type: issueTypeId },
      })
    );
  }
}
