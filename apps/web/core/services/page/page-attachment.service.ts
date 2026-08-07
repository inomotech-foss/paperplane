/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { AxiosRequestConfig } from "axios";
import { API_BASE_URL } from "@plane/constants";
import { getFileMetaDataForUpload, generateFileUploadPayload } from "@plane/services";
import type { TPageAttachment, TPageAttachmentUploadResponse } from "@plane/types";
// services
import { APIService } from "@/services/api.service";
import { FileUploadService } from "@/services/file-upload.service";

export class PageAttachmentService extends APIService {
  private fileUploadService: FileUploadService;

  constructor() {
    super(API_BASE_URL);
    this.fileUploadService = new FileUploadService();
  }

  private basePath(workspaceSlug: string, projectId: string, pageId: string): string {
    return `/api/assets/v2/workspaces/${workspaceSlug}/projects/${projectId}/pages/${pageId}/attachments/`;
  }

  private async markUploaded(
    workspaceSlug: string,
    projectId: string,
    pageId: string,
    attachmentId: string
  ): Promise<void> {
    return this.patch(`${this.basePath(workspaceSlug, projectId, pageId)}${attachmentId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Reserves the asset, uploads straight to storage, then confirms. The
   * attachment is not listed until the confirmation lands, so an abandoned
   * upload leaves no visible row.
   */
  async upload(
    workspaceSlug: string,
    projectId: string,
    pageId: string,
    file: File,
    uploadProgressHandler?: AxiosRequestConfig["onUploadProgress"]
  ): Promise<TPageAttachment> {
    const fileMetaData = await getFileMetaDataForUpload(file);
    return this.post(this.basePath(workspaceSlug, projectId, pageId), fileMetaData)
      .then(async (response) => {
        const signedURLResponse: TPageAttachmentUploadResponse = response?.data;
        const fileUploadPayload = generateFileUploadPayload(signedURLResponse, file);
        await this.fileUploadService.uploadFile(
          signedURLResponse.upload_data.url,
          fileUploadPayload,
          uploadProgressHandler
        );
        await this.markUploaded(workspaceSlug, projectId, pageId, signedURLResponse.asset_id);
        return signedURLResponse.attachment;
      })
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async list(workspaceSlug: string, projectId: string, pageId: string): Promise<TPageAttachment[]> {
    return this.get(this.basePath(workspaceSlug, projectId, pageId))
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async remove(workspaceSlug: string, projectId: string, pageId: string, attachmentId: string): Promise<void> {
    return this.delete(`${this.basePath(workspaceSlug, projectId, pageId)}${attachmentId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
