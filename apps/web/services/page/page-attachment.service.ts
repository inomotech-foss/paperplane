/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { getFileMetaDataForUpload, unwrap, uploadForm } from "@plane/services";
import type { UploadProgressHandler } from "@plane/services";
import type { TPageAttachment } from "@plane/types";
import { apiClient } from "@/services/api-client";
import { toPageAttachment } from "./page-convert";

const pagePath = (slug: string, project_id: string, page_id: string) => ({ path: { slug, project_id, page_id } });
const attachmentPath = (slug: string, project_id: string, page_id: string, pk: string) => ({
  path: { slug, project_id, page_id, pk },
});

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class PageAttachmentService {
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
    uploadProgressHandler?: UploadProgressHandler
  ): Promise<TPageAttachment> {
    const fileMetaData = await getFileMetaDataForUpload(file);
    const upload = await unwrap(
      apiClient.POST("/api/assets/v2/workspaces/{slug}/projects/{project_id}/pages/{page_id}/attachments/", {
        params: pagePath(workspaceSlug, projectId, pageId),
        body: fileMetaData,
      })
    );
    if (!upload.upload_data) throw new Error("The storage did not return an upload URL");
    const form = new FormData();
    for (const [key, value] of Object.entries(upload.upload_data.fields)) form.append(key, value);
    form.append("file", file);
    await uploadForm(upload.upload_data.url, form, { onProgress: uploadProgressHandler });
    await unwrap(
      apiClient.PATCH("/api/assets/v2/workspaces/{slug}/projects/{project_id}/pages/{page_id}/attachments/{pk}/", {
        params: attachmentPath(workspaceSlug, projectId, pageId, upload.asset_id),
      })
    );
    return toPageAttachment(upload.attachment);
  }

  async list(workspaceSlug: string, projectId: string, pageId: string): Promise<TPageAttachment[]> {
    const attachments = await unwrap(
      apiClient.GET("/api/assets/v2/workspaces/{slug}/projects/{project_id}/pages/{page_id}/attachments/", {
        params: pagePath(workspaceSlug, projectId, pageId),
      })
    );
    return attachments.map(toPageAttachment);
  }

  /**
   * The attachment's bytes as text, read through the app's own origin. The
   * download route redirects to storage, which is unreadable from script
   * without CORS on the bucket.
   */
  async readContent(workspaceSlug: string, projectId: string, pageId: string, attachmentId: string): Promise<string> {
    return unwrap(
      apiClient.GET(
        "/api/assets/v2/workspaces/{slug}/projects/{project_id}/pages/{page_id}/attachments/{pk}/content/",
        { params: attachmentPath(workspaceSlug, projectId, pageId, attachmentId), parseAs: "text" }
      )
    );
  }

  async remove(workspaceSlug: string, projectId: string, pageId: string, attachmentId: string): Promise<void> {
    await unwrap(
      apiClient.DELETE("/api/assets/v2/workspaces/{slug}/projects/{project_id}/pages/{page_id}/attachments/{pk}/", {
        params: attachmentPath(workspaceSlug, projectId, pageId, attachmentId),
      })
    );
  }
}
