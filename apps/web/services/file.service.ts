/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";
import { getFileMetaDataForUpload, unwrap, uploadToPresignedPost } from "@plane/services";
import type { UploadProgressHandler } from "@plane/services";
import type { EFileAssetType, TFileEntityInfo, TFileSignedURLResponse } from "@plane/types";
import { getAssetIdFromUrl } from "@plane/utils";
import { findLiteral, isRecord, readField } from "@plane/types";
import { isString } from "@/helpers/narrow.helper";
import { apiClient } from "@/services/api-client";

export type UnSplashImage = {
  id: string;
  alt_description: string | undefined;
  urls: { regular: string; small: string };
};

type TEntityType = ApiSchema<"FileAssetEntityTypeEnum">;

const ENTITY_TYPES: readonly TEntityType[] = [
  "ISSUE_ATTACHMENT",
  "ISSUE_DESCRIPTION",
  "COMMENT_DESCRIPTION",
  "PAGE_DESCRIPTION",
  "PAGE_ATTACHMENT",
  "PAGE_COMMENT_DESCRIPTION",
  "USER_COVER",
  "USER_AVATAR",
  "WORKSPACE_LOGO",
  "PROJECT_COVER",
  "DRAFT_ISSUE_ATTACHMENT",
  "DRAFT_ISSUE_DESCRIPTION",
];

/** The asset entity types the API stores. The others belong to features this instance does not have. */
export function toEntityType(type: EFileAssetType): TEntityType {
  const known = findLiteral(ENTITY_TYPES, type);
  if (!known) throw new Error(`The API does not store assets of type ${type}`);
  return known;
}

const toUnsplashImage = (value: unknown): UnSplashImage | undefined => {
  const urls = readField(value, "urls");
  const id = readField(value, "id");
  const regular = readField(urls, "regular");
  const small = readField(urls, "small");
  if (!isString(id) || !isString(regular) || !isString(small)) return undefined;
  const alt = readField(value, "alt_description");
  return { id, alt_description: isString(alt) ? alt : undefined, urls: { regular, small } };
};

/** The Unsplash response is passed through: a search wraps the photos in `results`, the photo list does not. */
export function parseUnsplashImages(data: unknown): UnSplashImage[] {
  const results = isRecord(data) ? readField(data, "results") : data;
  if (!Array.isArray(results)) return [];
  return results.flatMap((item: unknown) => {
    const image = toUnsplashImage(item);
    return image ? [image] : [];
  });
}

/** The presigned upload of an asset. The API returns no upload form when storage could not sign one. */
function toSignedUpload(upload: ApiSchema<"AssetUpload">): TFileSignedURLResponse {
  if (!upload.upload_data) throw new Error("The storage did not return an upload URL");
  return { asset_id: upload.asset_id, asset_url: upload.asset_url, upload_data: upload.upload_data };
}

/** The URL of an uploaded image. Images always get one, so a missing URL is an error. */
export function getUploadedAssetUrl(upload: TFileSignedURLResponse): string {
  if (!upload.asset_url) throw new Error("The API returned no URL for the uploaded image");
  return upload.asset_url;
}

const toUploadBody = async (data: TFileEntityInfo, file: File) => ({
  ...(await getFileMetaDataForUpload(file)),
  entity_identifier: data.entity_identifier,
  entity_type: toEntityType(data.entity_type),
});

const workspacePath = (slug: string) => ({ path: { slug } });
const workspaceAssetPath = (slug: string, asset_id: string) => ({ path: { slug, asset_id } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class FileService {
  private uploadController = new AbortController();

  constructor() {
    this.cancelUpload = this.cancelUpload.bind(this);
  }

  async uploadWorkspaceAsset(
    workspaceSlug: string,
    data: TFileEntityInfo,
    file: File,
    uploadProgressHandler?: UploadProgressHandler
  ): Promise<TFileSignedURLResponse> {
    const upload = toSignedUpload(
      await unwrap(
        apiClient.POST("/api/assets/v2/workspaces/{slug}/", {
          params: workspacePath(workspaceSlug),
          body: await toUploadBody(data, file),
        })
      )
    );
    await uploadToPresignedPost(upload, file, {
      onProgress: uploadProgressHandler,
      signal: this.uploadController.signal,
    });
    await unwrap(
      apiClient.PATCH("/api/assets/v2/workspaces/{slug}/{asset_id}/", {
        params: workspaceAssetPath(workspaceSlug, upload.asset_id),
      })
    );
    return upload;
  }

  async deleteWorkspaceAsset(workspaceSlug: string, assetId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/assets/v2/workspaces/{slug}/{asset_id}/", {
        params: workspaceAssetPath(workspaceSlug, assetId),
      })
    );
  }

  async updateBulkProjectAssetsUploadStatus(
    workspaceSlug: string,
    projectId: string,
    entityId: string,
    data: { asset_ids: string[] }
  ): Promise<void> {
    return unwrap(
      apiClient.POST("/api/assets/v2/workspaces/{slug}/projects/{project_id}/{entity_id}/bulk/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, entity_id: entityId } },
        body: data,
      })
    );
  }

  async uploadProjectAsset(
    workspaceSlug: string,
    projectId: string,
    data: TFileEntityInfo,
    file: File,
    uploadProgressHandler?: UploadProgressHandler
  ): Promise<TFileSignedURLResponse> {
    const upload = toSignedUpload(
      await unwrap(
        apiClient.POST("/api/assets/v2/workspaces/{slug}/projects/{project_id}/", {
          params: { path: { slug: workspaceSlug, project_id: projectId } },
          body: await toUploadBody(data, file),
        })
      )
    );
    await uploadToPresignedPost(upload, file, {
      onProgress: uploadProgressHandler,
      signal: this.uploadController.signal,
    });
    await unwrap(
      apiClient.PATCH("/api/assets/v2/workspaces/{slug}/projects/{project_id}/{pk}/", {
        params: { path: { slug: workspaceSlug, project_id: projectId, pk: upload.asset_id } },
      })
    );
    return upload;
  }

  async uploadUserAsset(data: TFileEntityInfo, file: File): Promise<TFileSignedURLResponse> {
    const upload = toSignedUpload(
      await unwrap(apiClient.POST("/api/assets/v2/user-assets/", { body: await toUploadBody(data, file) }))
    );
    await uploadToPresignedPost(upload, file, { signal: this.uploadController.signal });
    await unwrap(
      apiClient.PATCH("/api/assets/v2/user-assets/{asset_id}/", { params: { path: { asset_id: upload.asset_id } } })
    );
    return upload;
  }

  async deleteUserAsset(assetId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/assets/v2/user-assets/{asset_id}/", { params: { path: { asset_id: assetId } } })
    );
  }

  /** Deletes an editor asset, which is a project asset when the editor belongs to a project. */
  async deleteEditorAsset(workspaceSlug: string, projectId: string | undefined, assetId: string): Promise<void> {
    if (projectId) {
      return unwrap(
        apiClient.DELETE("/api/assets/v2/workspaces/{slug}/projects/{project_id}/{pk}/", {
          params: { path: { slug: workspaceSlug, project_id: projectId, pk: assetId } },
        })
      );
    }
    return this.deleteWorkspaceAsset(workspaceSlug, assetId);
  }

  async deleteOldWorkspaceAsset(workspaceId: string, src: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/file-assets/{workspace_id}/{asset_key}/", {
        params: { path: { workspace_id: workspaceId, asset_key: getAssetIdFromUrl(src) } },
      })
    );
  }

  async deleteOldUserAsset(src: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/users/file-assets/{asset_key}/", {
        params: { path: { asset_key: getAssetIdFromUrl(src) } },
      })
    );
  }

  async restoreNewAsset(workspaceSlug: string, src: string): Promise<void> {
    return unwrap(
      apiClient.POST("/api/assets/v2/workspaces/{slug}/restore/{asset_id}/", {
        params: workspaceAssetPath(workspaceSlug, getAssetIdFromUrl(src)),
      })
    );
  }

  async checkIfAssetExists(workspaceSlug: string, assetId: string): Promise<{ exists: boolean }> {
    return unwrap(
      apiClient.GET("/api/assets/v2/workspaces/{slug}/check/{asset_id}/", {
        params: workspaceAssetPath(workspaceSlug, assetId),
      })
    );
  }

  async restoreOldEditorAsset(workspaceId: string, src: string): Promise<void> {
    return unwrap(
      apiClient.POST("/api/workspaces/file-assets/{workspace_id}/{asset_key}/restore/", {
        params: { path: { workspace_id: workspaceId, asset_key: getAssetIdFromUrl(src) } },
      })
    );
  }

  cancelUpload() {
    this.uploadController.abort();
    this.uploadController = new AbortController();
  }

  async getUnsplashImages(query?: string): Promise<UnSplashImage[]> {
    const data: unknown = await unwrap(apiClient.GET("/api/unsplash/", { params: { query: { query } } }));
    return parseUnsplashImages(data);
  }

  async duplicateAsset(
    workspaceSlug: string,
    assetId: string,
    data: { entity_id?: string; entity_type: EFileAssetType; project_id?: string }
  ): Promise<{ asset_id: string }> {
    return unwrap(
      apiClient.POST("/api/assets/v2/workspaces/{slug}/duplicate-assets/{asset_id}/", {
        params: workspaceAssetPath(workspaceSlug, assetId),
        body: { ...data, entity_type: toEntityType(data.entity_type) },
      })
    );
  }
}
