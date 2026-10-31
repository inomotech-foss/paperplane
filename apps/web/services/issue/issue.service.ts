// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ApiRequestBody, ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import type {
  TGanttDateRollup,
  TIssue,
  TIssueLink,
  TIssueRow,
  TIssuesResponse,
  TIssueSubIssues,
  TSubIssuesStateDistribution,
} from "@plane/types";
import { apiClient } from "@/services/api-client";
import { toIssueListQuery, wantsRelations } from "./issue-query";
import type { TIssueParamsRecord } from "./issue-query";
import { toBaseIssue, toIssue, toIssueCreateBody, toIssueLink, toIssuesResponse, toIssueWriteBody } from "./work-item";

export type TIssueLinkUpdateBody = ApiRequestBody<
  "/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/issue-links/{pk}/",
  "patch"
>;
export type TIssueDateUpdate = ApiSchema<"IssueDateUpdateRequest">;
export type TIssueMeta = ApiSchema<"WorkItemMeta">;

/** Abort options of a list request. */
export type TRequestOptions = { signal?: AbortSignal };

/** A work item with the links that the detail endpoints embed. */
export type TIssueWithLinks = { issue: TIssueRow; links: TIssueLink[] };

const DETAIL_EXPAND = "issue_link,parent";

const projectPath = (slug: string, project_id: string) => ({ path: { slug, project_id } });
const issuePath = (slug: string, project_id: string, pk: string) => ({ path: { slug, project_id, pk } });
const subPath = (slug: string, project_id: string, issue_id: string) => ({ path: { slug, project_id, issue_id } });

const STATE_GROUPS = ["backlog", "unstarted", "started", "completed", "cancelled"] as const;

export const toStateDistribution = (distribution: Record<string, string[]>): TSubIssuesStateDistribution => {
  const result: TSubIssuesStateDistribution = { backlog: [], unstarted: [], started: [], completed: [], cancelled: [] };
  for (const group of STATE_GROUPS) result[group] = distribution[group] ?? [];
  return result;
};

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class IssueService {
  async createIssue(workspaceSlug: string, projectId: string, data: Partial<TIssue>): Promise<TIssueRow> {
    const created = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/issues/", {
        params: projectPath(workspaceSlug, projectId),
        body: toIssueCreateBody(data),
      })
    );
    return toBaseIssue(created);
  }

  async getIssues(
    workspaceSlug: string,
    projectId: string,
    queries?: TIssueParamsRecord,
    options: TRequestOptions = {}
  ): Promise<TIssuesResponse> {
    const query = toIssueListQuery(queries);
    if (wantsRelations(queries)) {
      const expand = typeof queries?.expand === "string" ? queries.expand : undefined;
      const page = await unwrap(
        apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issues-detail/", {
          params: { ...projectPath(workspaceSlug, projectId), query: { ...query, expand } },
          ...options,
        })
      );
      return toIssuesResponse(page);
    }
    const page = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issues/", {
        params: { ...projectPath(workspaceSlug, projectId), query },
        ...options,
      })
    );
    return toIssuesResponse(page);
  }

  async retrieve(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssueRow> {
    const detail = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issues/{pk}/", {
        params: issuePath(workspaceSlug, projectId, issueId),
      })
    );
    return toIssue(detail);
  }

  /** The work item with its parent and links, for the detail page. */
  async retrieveWithLinks(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssueWithLinks> {
    const detail = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issues/{pk}/", {
        params: { ...issuePath(workspaceSlug, projectId, issueId), query: { expand: DETAIL_EXPAND } },
      })
    );
    return { issue: toIssue(detail), links: (detail.issue_link ?? []).map(toIssueLink) };
  }

  async retrieveWithIdentifier(
    workspaceSlug: string,
    projectIdentifier: string,
    issueSequence: string
  ): Promise<TIssueWithLinks> {
    const detail = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/work-items/{project_identifier}-{issue_identifier}/", {
        params: {
          path: { slug: workspaceSlug, project_identifier: projectIdentifier, issue_identifier: issueSequence },
          query: { expand: DETAIL_EXPAND },
        },
      })
    );
    return { issue: toIssue(detail), links: (detail.issue_link ?? []).map(toIssueLink) };
  }

  async retrieveIssues(workspaceSlug: string, projectId: string, issueIds: string[]): Promise<TIssueRow[]> {
    const issues = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issues/list/", {
        params: { ...projectPath(workspaceSlug, projectId), query: { issues: issueIds.join(",") } },
      })
    );
    return issues.map(toBaseIssue);
  }

  /**
   * The date span of the work items below each listed work item, for rolling
   * dates up on the timeline. Work items without children are left out.
   */
  async getDateRollups(
    workspaceSlug: string,
    projectId: string,
    issueIds: string[]
  ): Promise<Record<string, TGanttDateRollup>> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issue-date-rollups/", {
        params: { ...projectPath(workspaceSlug, projectId), query: { issue_ids: issueIds.join(",") } },
      })
    );
  }

  async patchIssue(workspaceSlug: string, projectId: string, issueId: string, data: Partial<TIssue>): Promise<void> {
    return unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/issues/{pk}/", {
        params: issuePath(workspaceSlug, projectId, issueId),
        body: toIssueWriteBody(data),
      })
    );
  }

  async deleteIssue(workspaceSlug: string, projectId: string, issueId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/issues/{pk}/", {
        params: issuePath(workspaceSlug, projectId, issueId),
      })
    );
  }

  async updateIssueDates(workspaceSlug: string, projectId: string, updates: TIssueDateUpdate[]): Promise<void> {
    await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/issue-dates/", {
        params: projectPath(workspaceSlug, projectId),
        body: { updates },
      })
    );
  }

  async subIssues(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssueSubIssues> {
    const response = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/sub-issues/", {
        params: subPath(workspaceSlug, projectId, issueId),
      })
    );
    const subIssues = Array.isArray(response.sub_issues)
      ? response.sub_issues.map(toBaseIssue)
      : Object.fromEntries(
          Object.entries(response.sub_issues).map(([group, issues]) => [group, issues.map(toBaseIssue)])
        );
    return { state_distribution: toStateDistribution(response.state_distribution), sub_issues: subIssues };
  }

  async addSubIssues(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    subIssueIds: string[]
  ): Promise<TIssueSubIssues> {
    const response = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/sub-issues/", {
        params: subPath(workspaceSlug, projectId, issueId),
        body: { sub_issue_ids: subIssueIds },
      })
    );
    return {
      state_distribution: toStateDistribution(response.state_distribution),
      sub_issues: response.sub_issues.map(toBaseIssue),
    };
  }

  async fetchIssueLinks(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssueLink[]> {
    const links = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/issue-links/", {
        params: subPath(workspaceSlug, projectId, issueId),
      })
    );
    return links.map(toIssueLink);
  }

  async createIssueLink(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: Partial<TIssueLink>
  ): Promise<TIssueLink> {
    const { url, title } = data;
    if (!url) throw new Error("A link needs a URL");
    const link = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/issue-links/", {
        params: subPath(workspaceSlug, projectId, issueId),
        body: title === undefined ? { url } : { url, title },
      })
    );
    return toIssueLink(link);
  }

  async updateIssueLink(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    linkId: string,
    data: Partial<TIssueLink>
  ): Promise<TIssueLink> {
    const body: TIssueLinkUpdateBody = {};
    if (data.url !== undefined) body.url = data.url;
    if (data.title !== undefined) body.title = data.title;
    const link = await unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/issue-links/{pk}/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, issue_id: issueId, pk: linkId } },
        body,
      })
    );
    return toIssueLink(link);
  }

  async deleteIssueLink(workspaceSlug: string, projectId: string, issueId: string, linkId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/issue-links/{pk}/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, issue_id: issueId, pk: linkId } },
      })
    );
  }

  async bulkDeleteIssues(workspaceSlug: string, projectId: string, issueIds: string[]): Promise<void> {
    await unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/bulk-delete-issues/", {
        params: projectPath(workspaceSlug, projectId),
        body: { issue_ids: issueIds },
      })
    );
  }

  async bulkArchiveIssues(
    workspaceSlug: string,
    projectId: string,
    issueIds: string[]
  ): Promise<{ archived_at: string }> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/bulk-archive-issues/", {
        params: projectPath(workspaceSlug, projectId),
        body: { issue_ids: issueIds },
      })
    );
  }

  async getIssueNotificationSubscriptionStatus(
    workspaceSlug: string,
    projectId: string,
    issueId: string
  ): Promise<{ subscribed: boolean }> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/subscribe/", {
        params: subPath(workspaceSlug, projectId, issueId),
      })
    );
  }

  async unsubscribeFromIssueNotifications(workspaceSlug: string, projectId: string, issueId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/subscribe/", {
        params: subPath(workspaceSlug, projectId, issueId),
      })
    );
  }

  async subscribeToIssueNotifications(workspaceSlug: string, projectId: string, issueId: string): Promise<void> {
    await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/subscribe/", {
        params: subPath(workspaceSlug, projectId, issueId),
      })
    );
  }

  async getIssueMetaFromURL(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssueMeta> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/meta/", {
        params: subPath(workspaceSlug, projectId, issueId),
      })
    );
  }
}
