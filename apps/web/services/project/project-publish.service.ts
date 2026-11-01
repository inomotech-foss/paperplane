/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody, ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import type { TProjectPublishSettings, TPublishEntityType } from "@plane/types";
import { isOneOf } from "@plane/types";
import { apiClient } from "@/services/api-client";

type TPublishCreateBody = ApiRequestBody<"/api/workspaces/{slug}/projects/{project_id}/project-deploy-boards/", "post">;
type TPublishUpdateBody = ApiRequestBody<
  "/api/workspaces/{slug}/projects/{project_id}/project-deploy-boards/{pk}/",
  "patch"
>;

const PUBLISH_ENTITY_TYPES: TPublishEntityType[] = ["project", "page"];

const projectPath = (slug: string, project_id: string) => ({ path: { slug, project_id } });
const boardPath = (slug: string, project_id: string, pk: string) => ({ path: { slug, project_id, pk } });

export const toPublishSettings = (
  board: ApiSchema<"DeployBoard"> | ApiSchema<"UnpublishedDeployBoard">
): TProjectPublishSettings => {
  const shared = {
    is_comments_enabled: board.is_comments_enabled,
    is_reactions_enabled: board.is_reactions_enabled,
    is_votes_enabled: board.is_votes_enabled,
    intake: board.intake,
    intake_issue_type: board.intake_issue_type,
    created_by: board.created_by ?? undefined,
    updated_by: board.updated_by ?? undefined,
    inbox: undefined,
    project_details: undefined,
  };
  if (!("id" in board))
    return {
      ...shared,
      anchor: undefined,
      created_at: undefined,
      entity_identifier: undefined,
      entity_name: undefined,
      id: undefined,
      project: undefined,
      updated_at: undefined,
      workspace: undefined,
      workspace_detail: undefined,
      view_props: undefined,
    };
  return {
    ...shared,
    anchor: board.anchor,
    created_at: board.created_at,
    entity_identifier: board.entity_identifier ?? undefined,
    entity_name: isOneOf(PUBLISH_ENTITY_TYPES, board.entity_name) ? board.entity_name : undefined,
    id: board.id,
    project: board.project ?? undefined,
    updated_at: board.updated_at,
    workspace: board.workspace,
    workspace_detail: board.workspace_detail,
    view_props: board.view_props,
  };
};

const toPublishBody = (data: Partial<TProjectPublishSettings>) => ({
  is_comments_enabled: data.is_comments_enabled,
  is_reactions_enabled: data.is_reactions_enabled,
  is_votes_enabled: data.is_votes_enabled,
  intake: data.intake,
  intake_issue_type: data.intake_issue_type,
});

/** The create reads the layouts from `views`, the update from `view_props`. */
export const publishCreateBody = (data: Partial<TProjectPublishSettings>): TPublishCreateBody => ({
  ...toPublishBody(data),
  views: data.view_props,
});

export const publishUpdateBody = (data: Partial<TProjectPublishSettings>): TPublishUpdateBody => ({
  ...toPublishBody(data),
  view_props: data.view_props,
});

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class ProjectPublishService {
  async fetchPublishSettings(workspaceSlug: string, projectID: string): Promise<TProjectPublishSettings> {
    return toPublishSettings(
      await unwrap(
        apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/project-deploy-boards/", {
          params: projectPath(workspaceSlug, projectID),
        })
      )
    );
  }

  async publishProject(
    workspaceSlug: string,
    projectID: string,
    data: Partial<TProjectPublishSettings>
  ): Promise<TProjectPublishSettings> {
    return toPublishSettings(
      await unwrap(
        apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/project-deploy-boards/", {
          params: projectPath(workspaceSlug, projectID),
          body: publishCreateBody(data),
        })
      )
    );
  }

  async updatePublishSettings(
    workspaceSlug: string,
    projectID: string,
    project_publish_id: string,
    data: Partial<TProjectPublishSettings>
  ): Promise<TProjectPublishSettings> {
    return toPublishSettings(
      await unwrap(
        apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/project-deploy-boards/{pk}/", {
          params: boardPath(workspaceSlug, projectID, project_publish_id),
          body: publishUpdateBody(data),
        })
      )
    );
  }

  async unpublishProject(workspaceSlug: string, projectID: string, project_publish_id: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/project-deploy-boards/{pk}/", {
        params: boardPath(workspaceSlug, projectID, project_publish_id),
      })
    );
  }
}
