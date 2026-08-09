/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import { TrashIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import type { TPageAttachment } from "@plane/types";
import { CustomMenu } from "@plane/ui";
import { convertBytesToSize, getFileExtension, getFileName, getFileURL, renderFormattedDate } from "@plane/utils";
// components
import { getFileIcon } from "@/components/icons";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";

type Props = {
  attachment: TPageAttachment;
  disabled?: boolean;
  // Omitted where the list is only a view of the files, as in the editor block.
  onDelete?: (attachmentId: string) => void;
};

export function PageAttachmentListItem(props: Props) {
  const { attachment, disabled, onDelete } = props;
  const { t } = useTranslation();
  const { isMobile } = usePlatformOS();

  const name = attachment.attributes.name ?? "";
  const fileName = getFileName(name);
  const fileExtension = getFileExtension(name);
  const fileURL = getFileURL(attachment.asset_url ?? "");

  return (
    <div className="group flex h-11 items-center justify-between gap-2 rounded-sm px-2 hover:bg-layer-1">
      <button
        type="button"
        onClick={() => window.open(fileURL, "_blank", "noopener,noreferrer")}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <span className="shrink-0">{getFileIcon(fileExtension, 18)}</span>
        <span className="min-w-0 flex-1 space-y-0.5">
          <Tooltip tooltipContent={name} isMobile={isMobile}>
            <p className="truncate text-13 font-medium">{`${fileName}.${fileExtension}`}</p>
          </Tooltip>
          <p className="text-11 text-secondary">
            {convertBytesToSize(attachment.attributes.size)}
            {attachment.created_at ? ` · ${renderFormattedDate(attachment.created_at)}` : null}
          </p>
        </span>
      </button>
      {onDelete && (
        <CustomMenu ellipsis closeOnSelect placement="bottom-end" disabled={disabled}>
          <CustomMenu.MenuItem onClick={() => onDelete(attachment.id)}>
            <span className="flex items-center gap-2">
              <TrashIcon className="h-3.5 w-3.5" strokeWidth={2} />
              {t("common.actions.delete")}
            </span>
          </CustomMenu.MenuItem>
        </CustomMenu>
      )}
    </div>
  );
}
