/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TLogoProps } from "../client-json";

export type IFavoriteEntityData = {
  id?: string;
  name: string;
  logo_props?: TLogoProps | undefined;
  project_id?: string | null;
};

export type IFavorite = {
  id: string;
  name: string;
  entity_type: string;
  /** Null when the favorited entity is gone or no longer visible to the user. */
  entity_data: IFavoriteEntityData | null;
  is_folder: boolean;
  sort_order?: number | null;
  parent: string | null;
  entity_identifier?: string | null;
  children?: IFavorite[];
  project_id: string | null;
  sequence: number;
  workspace_id: string;
};
