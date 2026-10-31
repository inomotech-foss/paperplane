// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ApiRequestBody, ApiSchema } from "@plane/api-types";
import { parseLogoProps } from "@plane/types";
import type { IFavorite } from "@plane/types";

export type TFavoriteCreateBody = ApiRequestBody<"/api/workspaces/{slug}/user-favorites/", "post">;
export type TFavoriteUpdateBody = ApiRequestBody<"/api/workspaces/{slug}/user-favorites/{favorite_id}/", "patch">;

const toEntityData = (entity: ApiSchema<"FavoriteEntity">): NonNullable<IFavorite["entity_data"]> => ({
  id: entity.id,
  name: entity.name,
  logo_props: parseLogoProps(entity.logo_props),
  ...(entity.project_id === undefined ? {} : { project_id: entity.project_id }),
});

export const toFavorite = (row: ApiSchema<"UserFavorite">): IFavorite => ({
  id: row.id,
  name: row.name ?? "",
  entity_type: row.entity_type,
  entity_identifier: row.entity_identifier,
  entity_data: row.entity_data ? toEntityData(row.entity_data) : null,
  is_folder: row.is_folder,
  sequence: row.sequence,
  parent: row.parent,
  workspace_id: row.workspace_id,
  project_id: row.project_id,
});

export const toFavoriteUpdateBody = (data: Partial<IFavorite>): TFavoriteUpdateBody => ({
  name: data.name,
  sequence: data.sequence,
  parent: data.parent,
});

export const toFavoriteCreateBody = (data: Partial<IFavorite>): TFavoriteCreateBody => ({
  ...toFavoriteUpdateBody(data),
  entity_type: data.entity_type ?? "",
  entity_identifier: data.entity_identifier,
  is_folder: data.is_folder,
  project_id: data.project_id,
});
