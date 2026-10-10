// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import { apiClient } from "@/services/api-client";

export type TIssueTypeUsage = ApiSchema<"IssueTypeUsage">;

const typePath = (slug: string, project_id: string, pk: string) => ({ slug, project_id, pk });

/** Removing a work item type from a project. Errors are thrown as `ApiError` from `@plane/services`. */
export class IssueTypeRemovalService {
  /** How many rows of the project still use the type. */
  async getUsage(workspaceSlug: string, projectId: string, issueTypeId: string): Promise<TIssueTypeUsage> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issue-types/{pk}/usage/", {
        params: { path: typePath(workspaceSlug, projectId, issueTypeId) },
      })
    );
  }

  /** Removes the type from the project, moving the rows that use it to `replacementTypeId`. */
  async remove(workspaceSlug: string, projectId: string, issueTypeId: string, replacementTypeId?: string) {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/issue-types/{pk}/", {
        params: {
          path: typePath(workspaceSlug, projectId, issueTypeId),
          query: replacementTypeId ? { replacement_type_id: replacementTypeId } : undefined,
        },
      })
    );
  }
}

/** Every row that still uses a type, shown or not. */
export const countTypeReferences = (usage: TIssueTypeUsage) =>
  usage.work_items + usage.deleted_work_items + usage.drafts + usage.intakes + usage.automation_actions;
