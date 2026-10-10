// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import { apiClient } from "@/services/api-client";

export type TTypeMigrationPreview = ApiSchema<"IssueTypeMigrationPreview">;
export type TTypeMigrationProperty = ApiSchema<"IssueTypeMigrationProperty">;
export type TTypeMigrationRequest = ApiSchema<"IssueTypeMigrationRequest">;
export type TTypeMigrationScope = TTypeMigrationRequest["scope"];

const typePath = (slug: string, project_id: string, pk: string) => ({ slug, project_id, pk });

/** Moving work items between types. Errors are thrown as `ApiError` from `@plane/services`. */
export class IssueTypeMigrationService {
  /** What in the project uses the type, and which of its property values would need a decision. */
  async getUsage(workspaceSlug: string, projectId: string, issueTypeId: string): Promise<TTypeMigrationPreview> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issue-types/{pk}/usage/", {
        params: { path: typePath(workspaceSlug, projectId, issueTypeId) },
      })
    );
  }

  /** Moves the work items in scope to another type, or previews that with `dry_run`. */
  async migrate(
    workspaceSlug: string,
    projectId: string,
    issueTypeId: string,
    body: TTypeMigrationRequest
  ): Promise<TTypeMigrationPreview> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/issue-types/{pk}/migrate/", {
        params: { path: typePath(workspaceSlug, projectId, issueTypeId) },
        body,
      })
    );
  }

  /** Unlinks a type nothing in the project uses. */
  async remove(workspaceSlug: string, projectId: string, issueTypeId: string) {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/issue-types/{pk}/", {
        params: { path: typePath(workspaceSlug, projectId, issueTypeId) },
      })
    );
  }
}

/** Every row that still uses a type, shown or not. */
export const countTypeReferences = (usage: TTypeMigrationPreview["references"]) =>
  usage.work_items +
  usage.deleted_work_items +
  usage.drafts +
  usage.intake_forms +
  usage.service_desks +
  usage.automation_actions;
