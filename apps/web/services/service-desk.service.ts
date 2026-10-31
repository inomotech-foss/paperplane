// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ApiRequestBody, ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import type { TIssueEmailThread, TServiceDeskConfig } from "@plane/types";
import { apiClient } from "@/services/api-client";

export type TServiceDeskConfigBody = ApiRequestBody<
  "/api/workspaces/{slug}/projects/{project_id}/service-desk/",
  "post"
>;
export type TIssueEmailThreadBody = ApiRequestBody<
  "/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/email-thread/",
  "patch"
>;
export type TIssueEmailReplyBody = ApiRequestBody<
  "/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/email-replies/",
  "post"
>;

const projectPath = (slug: string, project_id: string) => ({ path: { slug, project_id } });
const issuePath = (slug: string, project_id: string, issue_id: string) => ({ path: { slug, project_id, issue_id } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class ServiceDeskService {
  async getConfig(workspaceSlug: string, projectId: string): Promise<TServiceDeskConfig> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/service-desk/", {
        params: projectPath(workspaceSlug, projectId),
      })
    );
  }

  async updateConfig(
    workspaceSlug: string,
    projectId: string,
    payload: TServiceDeskConfigBody
  ): Promise<TServiceDeskConfig> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/service-desk/", {
        params: projectPath(workspaceSlug, projectId),
        body: payload,
      })
    );
  }

  async getEmailThread(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssueEmailThread> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/email-thread/", {
        params: issuePath(workspaceSlug, projectId, issueId),
      })
    );
  }

  async updateEmailThread(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    payload: TIssueEmailThreadBody
  ): Promise<TIssueEmailThread> {
    return unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/email-thread/", {
        params: issuePath(workspaceSlug, projectId, issueId),
        body: payload,
      })
    );
  }

  async sendEmailReply(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    payload: TIssueEmailReplyBody
  ): Promise<ApiSchema<"EmailReply">> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/email-replies/", {
        params: issuePath(workspaceSlug, projectId, issueId),
        body: payload,
      })
    );
  }
}
