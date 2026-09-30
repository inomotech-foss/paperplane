/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { DeleteOutline, MoreHorizontalOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import type { TPageAttachment } from "@plane/types";
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
          <Tooltip label={name} disabled={isMobile}>
            <p className="truncate text-13 font-medium">{`${fileName}.${fileExtension}`}</p>
          </Tooltip>
          <p className="text-11 text-secondary">
            {convertBytesToSize(attachment.attributes.size)}
            {attachment.created_at ? ` · ${renderFormattedDate(attachment.created_at)}` : null}
          </p>
        </span>
      </button>
      {onDelete && (
        <Menu>
          <MenuTrigger
            disabled={disabled}
            render={
              <IconButton
                variant="ghost"
                size="sm"
                aria-label={t("aria_labels.common.more_actions")}
                icon={<Icon icon={MoreHorizontalOutline} />}
              />
            }
          />
          <MenuContent side="bottom" align="end">
            <MenuItem
              icon={<Icon icon={DeleteOutline} />}
              label={t("common.actions.delete")}
              onClick={() => onDelete(attachment.id)}
            />
          </MenuContent>
        </Menu>
      )}
    </div>
  );
}
