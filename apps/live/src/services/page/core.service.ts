/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { z } from "zod";
import { logger } from "@plane/logger";
import type { TDocumentPayload, TPage } from "@plane/types";
// services
import { AppError } from "@/lib/errors";
import { APIService } from "../api.service";

const userMentionSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  avatar_url: z.string().optional(),
});

export type TUserMention = z.infer<typeof userMentionSchema>;

const pageDetailsSchema = z.looseObject({
  name: z.string().optional(),
  description_html: z.string().nullish(),
});

/** The page fields live reads. */
export type TPageDetails = z.infer<typeof pageDetailsSchema>;

export abstract class PageCoreService extends APIService {
  protected abstract basePath: string;

  async fetchDetails(pageId: string): Promise<TPageDetails> {
    try {
      return pageDetailsSchema.parse(await this.requestJson("GET", `${this.basePath}/pages/${pageId}/`));
    } catch (error) {
      const appError = new AppError(error, {
        context: { operation: "fetchDetails", pageId },
      });
      logger.error("Failed to fetch page details", appError);
      throw appError;
    }
  }

  async fetchDescriptionBinary(pageId: string): Promise<Buffer> {
    try {
      const response = await this.request("GET", `${this.basePath}/pages/${pageId}/description/`, {
        headers: { "Content-Type": "application/octet-stream" },
      });
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      const appError = new AppError(error, {
        context: { operation: "fetchDescriptionBinary", pageId },
      });
      logger.error("Failed to fetch page description binary", appError);
      throw appError;
    }
  }

  /**
   * Updates the title of a page
   */
  async updatePageProperties(
    pageId: string,
    params: { data: Partial<TPage>; abortSignal?: AbortSignal }
  ): Promise<void> {
    const { data, abortSignal } = params;
    try {
      await this.request("PATCH", `${this.basePath}/pages/${pageId}/`, {
        body: data,
        ...(abortSignal ? { signal: abortSignal } : {}),
      });
    } catch (error) {
      const appError = new AppError(error, {
        context: { operation: "updatePageProperties", pageId },
      });
      if (appError.code !== "ABORT_ERROR") logger.error("Failed to update page properties", appError);
      throw appError;
    }
  }

  async updateDescriptionBinary(pageId: string, data: TDocumentPayload): Promise<void> {
    try {
      await this.request("PATCH", `${this.basePath}/pages/${pageId}/description/`, { body: data });
    } catch (error) {
      const appError = new AppError(error, {
        context: { operation: "updateDescriptionBinary", pageId },
      });
      logger.error("Failed to update page description binary", appError);
      throw appError;
    }
  }

  /**
   * Fetches user mentions for a page
   * @param pageId - The page ID
   * @returns Array of user mentions
   */
  async fetchUserMentions(pageId: string): Promise<TUserMention[]> {
    try {
      const data = await this.requestJson("GET", `${this.basePath}/pages/${pageId}/mentions/`, {
        query: { mention_type: "user_mention" },
      });
      return z.array(userMentionSchema).parse(data ?? []);
    } catch (error) {
      const appError = new AppError(error, {
        context: { operation: "fetchUserMentions", pageId },
      });
      logger.error("Failed to fetch user mentions", appError);
      throw appError;
    }
  }

  /**
   * Resolves an image asset ID to its actual URL by reading the 302 redirect
   * @param workspaceSlug - The workspace slug
   * @param assetId - The asset UUID
   * @param projectId - Optional project ID for project-specific assets
   * @returns The resolved image URL (presigned S3 URL)
   */
  async resolveImageAssetUrl(
    workspaceSlug: string,
    assetId: string,
    projectId?: string | null
  ): Promise<string | null> {
    const path = projectId
      ? `/api/assets/v2/workspaces/${workspaceSlug}/projects/${projectId}/${assetId}/?disposition=inline`
      : `/api/assets/v2/workspaces/${workspaceSlug}/${assetId}/?disposition=inline`;

    try {
      const response = await this.request("GET", path, { redirect: "manual" });
      if (response.status === 302 || response.status === 301) {
        return response.headers.get("location") || null;
      }
      return null;
    } catch (error) {
      logger.error("Failed to resolve image asset URL", {
        assetId,
        workspaceSlug,
        error: error instanceof Error ? error.message : undefined,
      });
      return null;
    }
  }

  /**
   * Resolves multiple image asset IDs to their actual URLs
   * @param workspaceSlug - The workspace slug
   * @param assetIds - Array of asset UUIDs
   * @param projectId - Optional project ID for project-specific assets
   * @returns Map of assetId to resolved URL
   */
  async resolveImageAssetUrls(
    workspaceSlug: string,
    assetIds: string[],
    projectId?: string | null
  ): Promise<Map<string, string>> {
    const urlMap = new Map<string, string>();

    // Resolve all asset URLs in parallel
    const results = await Promise.allSettled(
      assetIds.map(async (assetId) => {
        const url = await this.resolveImageAssetUrl(workspaceSlug, assetId, projectId);
        return { assetId, url };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.url) {
        urlMap.set(result.value.assetId, result.value.url);
      }
    }

    return urlMap;
  }
}
