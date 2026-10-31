/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { getFileMetaDataForUpload, unwrap, uploadForm } from "@plane/services";
import type { UploadProgressHandler } from "@plane/services";
import type { TIssueAttachment } from "@plane/types";
import { apiClient } from "@/services/api-client";

const issuePath = (slug: string, project_id: string, issue_id: string) => ({ path: { slug, project_id, issue_id } });
const attachmentPath = (slug: string, project_id: string, issue_id: string, pk: string) => ({
  path: { slug, project_id, issue_id, pk },
});

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class IssueAttachmentService {
  async uploadIssueAttachment(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    file: File,
    uploadProgressHandler?: UploadProgressHandler
  ): Promise<TIssueAttachment> {
    const fileMetaData = await getFileMetaDataForUpload(file);
    const upload = await unwrap(
      apiClient.POST("/api/assets/v2/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/attachments/", {
        params: issuePath(workspaceSlug, projectId, issueId),
        body: fileMetaData,
      })
    );
    if (!upload.upload_data) throw new Error("The storage did not return an upload URL");
    const form = new FormData();
    for (const [key, value] of Object.entries(upload.upload_data.fields)) form.append(key, value);
    form.append("file", file);
    await uploadForm(upload.upload_data.url, form, { onProgress: uploadProgressHandler });
    await unwrap(
      apiClient.PATCH("/api/assets/v2/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/attachments/{pk}/", {
        params: attachmentPath(workspaceSlug, projectId, issueId, upload.asset_id),
      })
    );
    return upload.attachment;
  }

  async getIssueAttachments(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssueAttachment[]> {
    return unwrap(
      apiClient.GET("/api/assets/v2/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/attachments/", {
        params: issuePath(workspaceSlug, projectId, issueId),
      })
    );
  }

  async deleteIssueAttachment(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    assetId: string
  ): Promise<void> {
    return unwrap(
      apiClient.DELETE("/api/assets/v2/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/attachments/{pk}/", {
        params: attachmentPath(workspaceSlug, projectId, issueId, assetId),
      })
    );
  }
}
