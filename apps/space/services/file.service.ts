/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { z } from "zod";
import { getAssetIdFromUrl, getFileMetaDataForUpload, unwrap, uploadForm } from "@plane/services";
import type { TFileEntityInfo } from "@plane/types";
import { apiClient } from "@/services/api-client";
import { sendJson } from "@/services/send-json";

const assetUploadSchema = z.object({
  asset_id: z.string(),
  asset_url: z.string().nullable(),
  upload_data: z.object({
    url: z.string(),
    fields: z.record(z.string(), z.string()),
  }),
});

export type TAssetUpload = z.infer<typeof assetUploadSchema>;

/** Parses the presigned upload the API returns for a new asset. */
export const parseAssetUpload = (data: unknown): TAssetUpload => assetUploadSchema.parse(data);

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
    // The schema has no request body for this operation.
    const upload = parseAssetUpload(
      await sendJson(`/api/public/assets/v2/anchor/${anchor}/`, { ...data, ...fileMetaData })
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

  /** The schema has no request body for this operation. */
  async updateBulkAssetsUploadStatus(anchor: string, entityId: string, data: { asset_ids: string[] }): Promise<void> {
    await sendJson(`/api/public/assets/v2/anchor/${anchor}/${entityId}/bulk/`, data);
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
