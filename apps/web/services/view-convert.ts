// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ApiRequestBody, ApiSchema } from "@plane/api-types";
import { parseDisplayFilters, parseDisplayProperties, parseLogoProps, parseRichFilters } from "@plane/types";
import type { IProjectView, IWorkspaceView } from "@plane/types";

export type TViewCreateBody = ApiRequestBody<"/api/workspaces/{slug}/views/", "post">;
export type TViewUpdateBody = ApiRequestBody<"/api/workspaces/{slug}/views/{pk}/", "patch">;

type TViewRow = ApiSchema<"IssueView">;
type TViewWrite = Partial<
  Pick<IProjectView, "name" | "description" | "rich_filters" | "display_filters" | "display_properties" | "logo_props">
>;

/** A workspace view. is_favorite stays out when the endpoint does not send it. */
export function toWorkspaceView(row: TViewRow): IWorkspaceView {
  const view: IWorkspaceView = {
    id: row.id,
    access: row.access,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
    name: row.name,
    description: row.description,
    rich_filters: parseRichFilters(row.rich_filters),
    display_filters: parseDisplayFilters(row.display_filters),
    display_properties: parseDisplayProperties(row.display_properties),
    project: row.project,
    workspace: row.workspace,
    is_locked: row.is_locked,
    owned_by: row.owned_by,
  };
  if (row.is_favorite !== undefined) view.is_favorite = row.is_favorite;
  return view;
}

/** A view of the project `projectId`. */
export const toProjectView = (row: TViewRow, projectId: string): IProjectView => ({
  ...toWorkspaceView(row),
  project: row.project ?? projectId,
  logo_props: parseLogoProps(row.logo_props),
});

/** The fields of `data` a view write accepts. */
export const toViewUpdateBody = (data: TViewWrite): TViewUpdateBody => ({
  name: data.name,
  description: data.description,
  rich_filters: data.rich_filters,
  display_filters: data.display_filters,
  display_properties: data.display_properties,
  logo_props: data.logo_props,
});

export const toViewCreateBody = (data: TViewWrite): TViewCreateBody => ({
  ...toViewUpdateBody(data),
  name: data.name ?? "",
});
