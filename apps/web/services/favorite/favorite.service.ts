/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unwrap } from "@plane/services";
import type { IFavorite } from "@plane/types";
import { apiClient } from "@/services/api-client";
import { toFavorite, toFavoriteCreateBody, toFavoriteUpdateBody } from "./favorite-convert";

const workspacePath = (slug: string) => ({ path: { slug } });
const favoritePath = (slug: string, favorite_id: string) => ({ path: { slug, favorite_id } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class FavoriteService {
  async addFavorite(workspaceSlug: string, data: Partial<IFavorite>): Promise<IFavorite> {
    const favorite = await unwrap(
      apiClient.POST("/api/workspaces/{slug}/user-favorites/", {
        params: workspacePath(workspaceSlug),
        body: toFavoriteCreateBody(data),
      })
    );
    return toFavorite(favorite);
  }

  async updateFavorite(workspaceSlug: string, favoriteId: string, data: Partial<IFavorite>): Promise<IFavorite> {
    const favorite = await unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/user-favorites/{favorite_id}/", {
        params: favoritePath(workspaceSlug, favoriteId),
        body: toFavoriteUpdateBody(data),
      })
    );
    return toFavorite(favorite);
  }

  async deleteFavorite(workspaceSlug: string, favoriteId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/user-favorites/{favorite_id}/", {
        params: favoritePath(workspaceSlug, favoriteId),
      })
    );
  }

  async getFavorites(workspaceSlug: string): Promise<IFavorite[]> {
    const favorites = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/user-favorites/", { params: workspacePath(workspaceSlug) })
    );
    return favorites.map(toFavorite);
  }

  async getGroupedFavorites(workspaceSlug: string, favoriteId: string): Promise<IFavorite[]> {
    const favorites = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/user-favorites/{favorite_id}/group/", {
        params: favoritePath(workspaceSlug, favoriteId),
      })
    );
    return favorites.map(toFavorite);
  }
}
