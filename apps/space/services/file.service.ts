/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";
import { getAssetIdFromUrl, getFileMetaDataForUpload, unwrap, uploadForm } from "@plane/services";
import { EFileAssetType } from "@plane/types";
import type { TFileEntityInfo } from "@plane/types";
import { apiClient } from "@/services/api-client";

type TUploadData = NonNullable<ApiSchema<"AssetUpload">["upload_data"]>;
export type TAssetUpload = Omit<ApiSchema<"AssetUpload">, "upload_data"> & { upload_data: TUploadData };

/** The public board stores comment images only. */
export function toEntityType(type: EFileAssetType): "COMMENT_DESCRIPTION" {
  if (type !== EFileAssetType.COMMENT_DESCRIPTION)
    throw new Error(`The public board does not store assets of type ${type}`);
  return "COMMENT_DESCRIPTION";
}

/** The presigned upload of a new asset. The API returns no upload form when storage could not sign one. */
export function toAssetUpload(upload: ApiSchema<"AssetUpload">): TAssetUpload {
  if (!upload.upload_data) throw new Error("The storage did not return an upload URL");
  return { ...upload, upload_data: upload.upload_data };
}

export const buildUploadForm = (upload: TAssetUpload, file: File): FormData => {
  const form = new FormData();
  for (const [key, value] of Object.entries(upload.upload_data.fields)) form.append(key, value);
  form.append("file", file);
  return form;
};

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class PublicFileService {
  private uploadController = new AbortController();

  constructor() {
    this.cancelUpload = this.cancelUpload.bind(this);
  }

  /** Creates the asset, uploads the file to storage and marks the asset as uploaded. */
  async uploadAsset(anchor: string, data: TFileEntityInfo, file: File): Promise<TAssetUpload> {
    const fileMetaData = await getFileMetaDataForUpload(file);
    const upload = toAssetUpload(
      await unwrap(
        apiClient.POST("/api/public/assets/v2/anchor/{anchor}/", {
          params: { path: { anchor } },
          body: {
            ...fileMetaData,
            entity_identifier: data.entity_identifier,
            entity_type: toEntityType(data.entity_type),
          },
        })
      )
    );
    await uploadForm(upload.upload_data.url, buildUploadForm(upload, file), {
      signal: this.uploadController.signal,
    });
    await unwrap(
      apiClient.PATCH("/api/public/assets/v2/anchor/{anchor}/{pk}/", {
        params: { path: { anchor, pk: upload.asset_id } },
      })
    );
    return upload;
  }

  async updateBulkAssetsUploadStatus(anchor: string, entityId: string, data: { asset_ids: string[] }): Promise<void> {
    await unwrap(
      apiClient.POST("/api/public/assets/v2/anchor/{anchor}/{entity_id}/bulk/", {
        params: { path: { anchor, entity_id: entityId } },
        body: data,
      })
    );
  }

  async deleteNewAsset(anchor: string, assetId: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/public/assets/v2/anchor/{anchor}/{pk}/", { params: { path: { anchor, pk: assetId } } })
    );
  }

  async restoreNewAsset(anchor: string, src: string): Promise<void> {
    return unwrap(
      apiClient.POST("/api/public/assets/v2/anchor/{anchor}/restore/{pk}/", {
        params: { path: { anchor, pk: getAssetIdFromUrl(src) } },
      })
    );
  }

  async deleteOldEditorAsset(workspaceId: string, src: string): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/file-assets/{workspace_id}/{asset_key}/", {
        params: { path: { workspace_id: workspaceId, asset_key: getAssetIdFromUrl(src) } },
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
}
