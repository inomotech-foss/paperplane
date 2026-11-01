// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ApiRequestBody, ApiSchema } from "@plane/api-types";
import { parseLogoProps } from "@plane/types";
import type { ILinkDetails, IModule } from "@plane/types";
import { toCycleDistribution, toCycleEstimateDistribution } from "@/services/cycle-convert";
import { toLinkMetadata } from "@/services/issue/work-item";

type TModuleRow =
  | ApiSchema<"ModuleListItem">
  | ApiSchema<"ModuleDetailResponse">
  | ApiSchema<"ArchivedModuleListItem">
  | ApiSchema<"WorkspaceModule">;

export type TModuleCreateBody = ApiRequestBody<"/api/workspaces/{slug}/projects/{project_id}/modules/", "post">;
export type TModuleUpdateBody = ApiRequestBody<"/api/workspaces/{slug}/projects/{project_id}/modules/{pk}/", "patch">;
export type TModuleLinkBody = ApiRequestBody<
  "/api/workspaces/{slug}/projects/{project_id}/modules/{module_id}/module-links/",
  "post"
>;

/** A module row of any module endpoint. Fields the endpoint does not send stay out, so store merges keep them. */
export function toModule(row: TModuleRow): IModule {
  const module: IModule = {
    id: row.id,
    workspace_id: row.workspace_id,
    project_id: row.project_id,
    name: row.name,
    description: row.description,
    description_text: row.description_text,
    description_html: row.description_html,
    lead_id: row.lead_id,
    member_ids: row.member_ids ?? [],
    sort_order: row.sort_order,
    start_date: row.start_date,
    target_date: row.target_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status: row.status,
    total_issues: row.total_issues ?? 0,
    completed_issues: row.completed_issues ?? 0,
    cancelled_issues: row.cancelled_issues ?? 0,
    started_issues: row.started_issues ?? 0,
    unstarted_issues: row.unstarted_issues ?? 0,
    backlog_issues: row.backlog_issues ?? 0,
  };
  if (row.is_favorite !== undefined) module.is_favorite = row.is_favorite;
  if ("archived_at" in row) module.archived_at = row.archived_at;
  if ("logo_props" in row) module.logo_props = parseLogoProps(row.logo_props);
  if ("total_estimate_points" in row && row.total_estimate_points !== undefined)
    module.total_estimate_points = row.total_estimate_points;
  if ("completed_estimate_points" in row && row.completed_estimate_points !== undefined)
    module.completed_estimate_points = row.completed_estimate_points;
  if ("backlog_estimate_points" in row) {
    module.backlog_estimate_points = row.backlog_estimate_points;
    module.started_estimate_points = row.started_estimate_points;
    module.unstarted_estimate_points = row.unstarted_estimate_points;
    module.cancelled_estimate_points = row.cancelled_estimate_points;
  }
  if ("sub_issues" in row) module.sub_issues = row.sub_issues;
  if ("link_module" in row) module.link_module = row.link_module.map(toModuleLink);
  if ("distribution" in row) module.distribution = toCycleDistribution(row.distribution);
  if ("estimate_distribution" in row)
    module.estimate_distribution = toCycleEstimateDistribution(row.estimate_distribution);
  return module;
}

export const toModuleLink = (link: ApiSchema<"ModuleLink">): ILinkDetails => ({
  id: link.id,
  title: link.title,
  url: link.url,
  metadata: toLinkMetadata(link.metadata),
  created_at: link.created_at,
  created_by: link.created_by,
});

/** The fields of `data` a module write accepts. */
export const toModuleUpdateBody = (data: Partial<IModule>): TModuleUpdateBody => ({
  name: data.name,
  description: data.description,
  start_date: data.start_date,
  target_date: data.target_date,
  status: data.status,
  lead_id: data.lead_id,
  member_ids: data.member_ids,
  sort_order: data.sort_order,
  logo_props: data.logo_props,
});

export const toModuleCreateBody = (data: Partial<IModule>): TModuleCreateBody => ({
  ...toModuleUpdateBody(data),
  name: data.name ?? "",
});

export const toModuleLinkBody = (data: Partial<ILinkDetails>): TModuleLinkBody => ({
  title: data.title,
  url: data.url ?? "",
});
