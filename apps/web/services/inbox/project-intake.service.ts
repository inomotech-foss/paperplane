// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ApiResponse } from "@plane/api-types";
import { unwrap } from "@plane/services";
import { apiClient } from "@/services/api-client";

export type TProjectIntake = ApiResponse<"/api/workspaces/{slug}/projects/{project_id}/intakes/", "get">;

/** The project's intake. Errors are thrown as `ApiError` from `@plane/services`. */
export class ProjectIntakeService {
  async getIntake(workspaceSlug: string, projectId: string): Promise<TProjectIntake> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/intakes/", {
        params: { path: { slug: workspaceSlug, project_id: projectId } },
      })
    );
  }
}
