/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody, ApiSchema, TTimezone } from "@plane/api-types";
import { unwrap } from "@plane/services";
import { parseIssueFiltersResponse, parseLogoProps, parseProjectUserPreferences } from "@plane/types";
import type {
  IProjectUserPropertiesResponse,
  ISearchIssueResponse,
  TPartialProject,
  TProject,
  TProjectAnalyticsCount,
  TProjectAnalyticsCountParams,
  TProjectIssuesSearchParams,
} from "@plane/types";
import { isTimezone } from "@/lib/timezone";
// services
import { apiClient } from "@/services/api-client";
import { toIssueSearchQuery } from "@/services/issue/issue-query";
import { toSearchIssue } from "@/services/issue/work-item";

export type TProjectCreateBody = ApiRequestBody<"/api/workspaces/{slug}/projects/", "post">;
export type TProjectUpdateBody = ApiRequestBody<"/api/workspaces/{slug}/projects/{pk}/", "patch">;
export type TProjectIdentifierCheck = ApiSchema<"ProjectIdentifierCheck">;
export type TProjectIssueSequence = ApiSchema<"IssueSequence">;

const NETWORKS: ApiSchema<"NetworkEnum">[] = [0, 2];

const toId = (value: { id: string } | string | null | undefined): string | null | undefined =>
  typeof value === "object" && value !== null ? value.id : value;

const toNetwork = (value: number | undefined): ApiSchema<"NetworkEnum"> | undefined => {
  if (value === undefined) return undefined;
  const network = NETWORKS.find((item) => item === value);
  if (network === undefined) throw new Error(`Unknown project network ${value}`);
  return network;
};

const toTimezone = (value: string | undefined): TTimezone | undefined => {
  if (value === undefined) return undefined;
  if (!isTimezone(value)) throw new Error(`Unknown timezone ${value}`);
  return value;
};

/** The fields of `data` the update writes. Throws for a network or timezone the API rejects. */
export const projectUpdateBody = (data: Partial<TProject>): TProjectUpdateBody => ({
  name: data.name,
  identifier: data.identifier,
  description: data.description,
  network: toNetwork(data.network),
  logo_props: data.logo_props,
  cycle_view: data.cycle_view,
  issue_views_view: data.issue_views_view,
  module_view: data.module_view,
  page_view: data.page_view,
  issue_view: data.issue_view,
  inbox_view: data.inbox_view,
  guest_view_all_features: data.guest_view_all_features,
  archive_in: data.archive_in,
  close_in: data.close_in,
  cover_image: data.cover_image,
  cover_image_asset: data.cover_image_asset,
  default_assignee: toId(data.default_assignee),
  default_state: data.default_state,
  estimate: data.estimate,
  project_lead: toId(data.project_lead),
  timezone: toTimezone(data.timezone),
});

/** Like the update, but the create reads the intake flag from `intake_view`. */
export const projectCreateBody = (data: Partial<TProject>): TProjectCreateBody => {
  const { inbox_view, ...body } = projectUpdateBody(data);
  return { ...body, name: data.name ?? "", identifier: data.identifier ?? "", intake_view: inbox_view };
};

const projectPath = (slug: string, project_id: string) => ({ path: { slug, project_id } });
const projectItemPath = (slug: string, pk: string) => ({ path: { slug, pk } });

export const toProject = (project: ApiSchema<"ProjectList">): TProject => ({
  ...project,
  logo_props: parseLogoProps(project.logo_props),
});

const toPartialProject = (project: ApiSchema<"ProjectListItem">): TPartialProject => ({
  ...project,
  logo_props: parseLogoProps(project.logo_props),
});

const toProjectUserProperties = (properties: ApiSchema<"ProjectUserProperty">): IProjectUserPropertiesResponse => ({
  ...properties,
  ...parseIssueFiltersResponse(properties),
  preferences: parseProjectUserPreferences(properties.preferences),
});

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class ProjectService {
  async createProject(workspaceSlug: string, data: Partial<TProject>): Promise<TProject> {
    return toProject(
      await unwrap(
        apiClient.POST("/api/workspaces/{slug}/projects/", {
          params: { path: { slug: workspaceSlug } },
          body: projectCreateBody(data),
        })
      )
    );
  }

  async checkProjectIdentifierAvailability(workspaceSlug: string, name: string): Promise<TProjectIdentifierCheck> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/project-identifiers/", {
        params: { path: { slug: workspaceSlug }, query: { name } },
      })
    );
  }

  async getProjectsLite(workspaceSlug: string): Promise<TPartialProject[]> {
    const projects = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/", { params: { path: { slug: workspaceSlug } } })
    );
    return projects.map(toPartialProject);
  }

  /** The API pages the list only when asked to, which this call never does. */
  async getProjects(workspaceSlug: string): Promise<TProject[]> {
    const response = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/details/", { params: { path: { slug: workspaceSlug } } })
    );
    return (Array.isArray(response) ? response : response.results).map(toProject);
  }

  async getProject(workspaceSlug: string, projectId: string): Promise<TProject> {
    return toProject(
      await unwrap(
        apiClient.GET("/api/workspaces/{slug}/projects/{pk}/", { params: projectItemPath(workspaceSlug, projectId) })
      )
    );
  }

  async getProjectAnalyticsCount(
    workspaceSlug: string,
    params?: TProjectAnalyticsCountParams
  ): Promise<TProjectAnalyticsCount[]> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/project-stats/", {
        params: { path: { slug: workspaceSlug }, query: params },
      })
    );
  }

  async updateProject(workspaceSlug: string, projectId: string, data: Partial<TProject>): Promise<TProject> {
    return toProject(
      await unwrap(
        apiClient.PATCH("/api/workspaces/{slug}/projects/{pk}/", {
          params: projectItemPath(workspaceSlug, projectId),
          body: projectUpdateBody(data),
        })
      )
    );
  }

  async deleteProject(workspaceSlug: string, projectId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{pk}/", { params: projectItemPath(workspaceSlug, projectId) })
    );
  }

  async getProjectUserProperties(workspaceSlug: string, projectId: string): Promise<IProjectUserPropertiesResponse> {
    return toProjectUserProperties(
      await unwrap(
        apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/user-properties/", {
          params: projectPath(workspaceSlug, projectId),
        })
      )
    );
  }

  async updateProjectUserProperties(
    workspaceSlug: string,
    projectId: string,
    data: Partial<IProjectUserPropertiesResponse>
  ): Promise<IProjectUserPropertiesResponse> {
    return toProjectUserProperties(
      await unwrap(
        apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/user-properties/", {
          params: projectPath(workspaceSlug, projectId),
          body: data,
        })
      )
    );
  }

  async projectIssuesSearch(
    workspaceSlug: string,
    projectId: string,
    params: TProjectIssuesSearchParams
  ): Promise<ISearchIssueResponse[]> {
    const results = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/search-issues/", {
        params: { ...projectPath(workspaceSlug, projectId), query: toIssueSearchQuery(params) },
      })
    );
    return results.map(toSearchIssue);
  }

  async setIssueSequenceStart(workspaceSlug: string, projectId: string, start: number): Promise<TProjectIssueSequence> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/issue-sequence/", {
        params: projectPath(workspaceSlug, projectId),
        body: { start },
      })
    );
  }
}
