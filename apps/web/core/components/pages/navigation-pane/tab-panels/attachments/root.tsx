/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
// hooks
import { useFileSize } from "@/hooks/use-file-size";
// store
import type { TPageInstance } from "@/store/pages/base-page";
// local imports
import { PageAttachmentListItem } from "./list-item";
import { usePageAttachments } from "./use-page-attachments";

type Props = {
  page: TPageInstance;
};

export const PageAttachments = observer(function PageAttachments(props: Props) {
  const { page } = props;
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
  const { maxFileSize } = useFileSize();

  const projectId = page.project_ids?.[0];
  const disabled = !page.canCurrentUserEditPage;

  const { attachments, uploadingCount, upload, remove } = usePageAttachments({
    workspaceSlug: workspaceSlug?.toString(),
    projectId,
    pageId: page.id,
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach((file) => upload(file));
    },
    [upload]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject, fileRejections } = useDropzone({
    onDrop,
    maxSize: maxFileSize,
    disabled: disabled || uploadingCount > 0,
  });

  const rejected = fileRejections.length > 0;

  return (
    <div className="space-y-2">
      <h5 className="text-11 font-semibold tracking-wide text-secondary uppercase">
        {t("page_navigation_pane.tabs.assets.attachments.title")}
      </h5>

      {attachments.map((attachment) => (
        <PageAttachmentListItem key={attachment.id} attachment={attachment} disabled={disabled} onDelete={remove} />
      ))}

      {!disabled && (
        <div
          {...getRootProps()}
          className={cn(
            "flex h-14 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-subtle bg-accent-primary/5 px-3 text-11 text-accent-primary",
            {
              "border-accent-strong bg-accent-primary/10": isDragActive,
              "bg-danger-subtle": isDragReject || rejected,
              "cursor-not-allowed": uploadingCount > 0,
            }
          )}
        >
          <input {...getInputProps()} />
          <p className="text-center">
            {uploadingCount > 0
              ? t("page_navigation_pane.tabs.assets.attachments.uploading")
              : rejected
                ? t("page_navigation_pane.tabs.assets.attachments.too_large", {
                    size: Math.round(maxFileSize / 1024 / 1024),
                  })
                : t("page_navigation_pane.tabs.assets.attachments.dropzone")}
          </p>
        </div>
      )}
    </div>
  );
});
