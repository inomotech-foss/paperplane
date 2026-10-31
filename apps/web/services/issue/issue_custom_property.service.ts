/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unwrap } from "@plane/services";
import { parseBulkPropertyValues, parseIssueCustomProperty, parsePropertyValuesResponse } from "@plane/types";
import type {
  TBulkIssueCustomPropertyValues,
  TIssueCustomProperty,
  TIssueCustomPropertyOption,
  TIssueCustomPropertyValueMap,
  TIssueCustomPropertyValuesResponse,
} from "@plane/types";
import { apiClient } from "@/services/api-client";

export type TPropertyUpdateBody = Partial<
  Pick<
    TIssueCustomProperty,
    | "name"
    | "display_name"
    | "property_type"
    | "is_multi"
    | "relation_type"
    | "is_active"
    | "is_required"
    | "sort_order"
    | "settings"
    | "issue_type"
    | "derivation"
    | "derivation_config"
  >
>;
export type TPropertyOptionUpdateBody = Partial<Pick<TIssueCustomPropertyOption, "name" | "sort_order" | "is_default">>;
export type TPropertyOptionCreateBody = TPropertyOptionUpdateBody & Pick<TIssueCustomPropertyOption, "name">;
export type TPropertyCreateBody = TPropertyUpdateBody &
  Pick<TIssueCustomProperty, "name"> & { options?: TPropertyOptionCreateBody[] };

const projectPath = (slug: string, project_id: string) => ({ path: { slug, project_id } });
const propertyPath = (slug: string, project_id: string, pk: string) => ({ path: { slug, project_id, pk } });
const optionsPath = (slug: string, project_id: string, property_id: string) => ({
  path: { slug, project_id, property_id },
});
const optionPath = (slug: string, project_id: string, property_id: string, pk: string) => ({
  path: { slug, project_id, property_id, pk },
});
const issuePath = (slug: string, project_id: string, issue_id: string) => ({ path: { slug, project_id, issue_id } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class IssueCustomPropertyService {
  async getProjectProperties(workspaceSlug: string, projectId: string): Promise<TIssueCustomProperty[]> {
    const properties = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issue-properties/", {
        params: projectPath(workspaceSlug, projectId),
      })
    );
    return properties.map(parseIssueCustomProperty);
  }

  async createProperty(
    workspaceSlug: string,
    projectId: string,
    data: TPropertyCreateBody
  ): Promise<TIssueCustomProperty> {
    const property = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/issue-properties/", {
        params: projectPath(workspaceSlug, projectId),
        body: data,
      })
    );
    return parseIssueCustomProperty(property);
  }

  async patchProperty(
    workspaceSlug: string,
    projectId: string,
    propertyId: string,
    data: TPropertyUpdateBody
  ): Promise<TIssueCustomProperty> {
    const property = await unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/issue-properties/{pk}/", {
        params: propertyPath(workspaceSlug, projectId, propertyId),
        body: data,
      })
    );
    return parseIssueCustomProperty(property);
  }

  async deleteProperty(workspaceSlug: string, projectId: string, propertyId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/issue-properties/{pk}/", {
        params: propertyPath(workspaceSlug, projectId, propertyId),
      })
    );
  }

  async createOption(
    workspaceSlug: string,
    projectId: string,
    propertyId: string,
    data: TPropertyOptionCreateBody
  ): Promise<TIssueCustomPropertyOption> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/projects/{project_id}/issue-properties/{property_id}/options/", {
        params: optionsPath(workspaceSlug, projectId, propertyId),
        body: data,
      })
    );
  }

  async patchOption(
    workspaceSlug: string,
    projectId: string,
    propertyId: string,
    optionId: string,
    data: TPropertyOptionUpdateBody
  ): Promise<TIssueCustomPropertyOption> {
    return unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/projects/{project_id}/issue-properties/{property_id}/options/{pk}/", {
        params: optionPath(workspaceSlug, projectId, propertyId, optionId),
        body: data,
      })
    );
  }

  async deleteOption(workspaceSlug: string, projectId: string, propertyId: string, optionId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/projects/{project_id}/issue-properties/{property_id}/options/{pk}/", {
        params: optionPath(workspaceSlug, projectId, propertyId, optionId),
      })
    );
  }

  async getIssueValues(
    workspaceSlug: string,
    projectId: string,
    issueId: string
  ): Promise<TIssueCustomPropertyValuesResponse> {
    const values = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/property-values/", {
        params: issuePath(workspaceSlug, projectId, issueId),
      })
    );
    return parsePropertyValuesResponse(values);
  }

  async updateIssueValues(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: TIssueCustomPropertyValueMap
  ): Promise<TIssueCustomPropertyValuesResponse> {
    const values = await unwrap(
      apiClient.PUT("/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/property-values/", {
        params: issuePath(workspaceSlug, projectId, issueId),
        body: data,
      })
    );
    return parsePropertyValuesResponse(values);
  }

  async getBulkValues(
    workspaceSlug: string,
    projectId: string,
    issueIds?: string[]
  ): Promise<TBulkIssueCustomPropertyValues> {
    const values = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/projects/{project_id}/issue-property-values/", {
        params: {
          path: { slug: workspaceSlug, project_id: projectId },
          query: issueIds?.length ? { issue_ids: issueIds.join(",") } : {},
        },
      })
    );
    return parseBulkPropertyValues(values);
  }
}
