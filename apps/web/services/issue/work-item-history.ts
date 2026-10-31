// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ApiResponse, ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import { apiClient } from "@/services/api-client";

type THistoryEntry = ApiResponse<
  "/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/history/",
  "get"
>[number];

export type TApiIssueComment = ApiSchema<"IssueComment">;
export type TApiIssueActivity = ApiSchema<"IssueActivity">;

export const isHistoryComment = (entry: THistoryEntry): entry is TApiIssueComment => "comment_html" in entry;

export const isHistoryActivity = (entry: THistoryEntry): entry is TApiIssueActivity => "verb" in entry;

/** The history of a work item, only its comments or only its other activity. */
export async function fetchWorkItemHistory(
  workspaceSlug: string,
  projectId: string,
  issueId: string,
  activityType: "issue-comment" | "issue-property",
  createdAfter?: string
): Promise<THistoryEntry[]> {
  return unwrap(
    apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/history/", {
      params: {
        path: { slug: workspaceSlug, project_id: projectId, issue_id: issueId },
        query: { activity_type: activityType, ...(createdAfter ? { created_at__gt: createdAfter } : {}) },
      },
    })
  );
}
