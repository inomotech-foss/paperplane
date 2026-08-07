/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { useTranslation } from "@plane/i18n";
import type { TPageAttachment } from "@plane/types";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// services
import { PageAttachmentService } from "@/services/page";

const pageAttachmentService = new PageAttachmentService();

type Args = {
  workspaceSlug: string | undefined;
  projectId: string | undefined;
  pageId: string | undefined;
};

export type TPageAttachmentOperations = {
  attachments: TPageAttachment[];
  isLoading: boolean;
  uploadingCount: number;
  upload: (file: File) => Promise<void>;
  remove: (attachmentId: string) => Promise<void>;
};

export function usePageAttachments(args: Args): TPageAttachmentOperations {
  const { workspaceSlug, projectId, pageId } = args;
  const [uploadingCount, setUploadingCount] = useState(0);
  const { t } = useTranslation();

  const key = workspaceSlug && projectId && pageId ? `PAGE_ATTACHMENTS_${workspaceSlug}_${projectId}_${pageId}` : null;

  const { data, isLoading, mutate } = useSWR(key, () =>
    pageAttachmentService.list(workspaceSlug as string, projectId as string, pageId as string)
  );

  const upload = useCallback(
    async (file: File) => {
      if (!workspaceSlug || !projectId || !pageId) return;
      setUploadingCount((count) => count + 1);
      try {
        await pageAttachmentService.upload(workspaceSlug, projectId, pageId, file);
        await mutate();
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: t("common.success"),
          message: t("page_navigation_pane.tabs.assets.attachments.upload_success"),
        });
      } catch {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: t("common.error.label"),
          message: t("page_navigation_pane.tabs.assets.attachments.upload_error"),
        });
      } finally {
        setUploadingCount((count) => count - 1);
      }
    },
    [workspaceSlug, projectId, pageId, mutate, t]
  );

  const remove = useCallback(
    async (attachmentId: string) => {
      if (!workspaceSlug || !projectId || !pageId) return;
      try {
        await pageAttachmentService.remove(workspaceSlug, projectId, pageId, attachmentId);
        await mutate();
      } catch {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: t("common.error.label"),
          message: t("page_navigation_pane.tabs.assets.attachments.delete_error"),
        });
      }
    },
    [workspaceSlug, projectId, pageId, mutate, t]
  );

  return useMemo(
    () => ({ attachments: data ?? [], isLoading, uploadingCount, upload, remove }),
    [data, isLoading, uploadingCount, upload, remove]
  );
}
