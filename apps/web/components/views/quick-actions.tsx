/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { MoreHorizontalOutline } from "@makeplane/propel/icons";
// types
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Icon } from "@makeplane/propel/components/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { setToast } from "@plane/blocks/toast";
import type { IProjectView } from "@plane/types";
// ui
import type { TContextMenuItem } from "@plane/blocks/context-menu";
import { ContextMenu, getRenderableItems, resolveItemVariant } from "@plane/blocks/context-menu";
import { copyUrlToClipboard } from "@plane/utils";
// helpers
import { useViewMenuItems } from "@/components/common/quick-actions-helper";
// hooks
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useMountOnOpen } from "@/hooks/use-mount-on-open";
import type { TRowDialog } from "@/hooks/use-row-dialog";
import { useRowDialog } from "@/hooks/use-row-dialog";
import { useViewPublish } from "@/components/views/publish";
// local imports
import { DeleteProjectViewModal } from "./delete-view-modal";
import { CreateUpdateProjectViewModal } from "./modal";

type Props = {
  parentRef: React.RefObject<HTMLElement | null>;
  projectId: string;
  view: IProjectView;
  workspaceSlug: string;
  /**
   * @deprecated Accepted and ignored. The trigger is a Propel `IconButton`, which takes no
   * `className`, and the legacy dropdown already dropped this class whenever a custom trigger was
   * passed.
   */
  customClassName?: string;
  /** Dialog state owned by the row. The row then renders `ViewQuickActionDialogs` itself. */
  dialog?: TRowDialog<TViewDialog>;
};

export type TViewDialog = "edit" | "delete";

type TDialogsProps = {
  projectId: string;
  view: IProjectView;
  workspaceSlug: string;
  dialog: TRowDialog<TViewDialog>;
};

/** The edit and delete dialogs of a view. Each mounts the first time it opens. */
export function ViewQuickActionDialogs(props: TDialogsProps) {
  const { projectId, view, workspaceSlug, dialog } = props;
  const showUpdateModal = useMountOnOpen(dialog.open === "edit");
  const showDeleteModal = useMountOnOpen(dialog.open === "delete");
  const handleClose = () => dialog.setOpen(null);

  return (
    <>
      {showUpdateModal && (
        <CreateUpdateProjectViewModal
          isOpen={dialog.open === "edit"}
          onClose={handleClose}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          data={view}
        />
      )}
      {showDeleteModal && (
        <DeleteProjectViewModal data={view} isOpen={dialog.open === "delete"} onClose={handleClose} />
      )}
    </>
  );
}

export const ViewQuickActions = observer(function ViewQuickActions(props: Props) {
  const { parentRef, projectId, view, workspaceSlug } = props;
  // plane hooks
  const { t } = useTranslation();
  // states
  const ownDialog = useRowDialog<TViewDialog>();
  const dialog = props.dialog ?? ownDialog;
  // store hooks
  const { data } = useUser();
  const { allowPermissions } = useUserPermissions();
  // auth
  const isOwner = view?.owned_by === data?.id;
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId);

  const { publishContextMenu } = useViewPublish(!!view.anchor, isAdmin || isOwner);

  const viewLink = `${workspaceSlug}/projects/${projectId}/views/${view.id}`;
  const handleCopyText = () =>
    // oxlint-disable-next-line promise/always-return
    copyUrlToClipboard(viewLink).then(() => {
      setToast({
        type: "success",
        title: "Link Copied!",
        message: "View link copied to clipboard.",
      });
    });
  const handleOpenInNewTab = () => window.open(`/${viewLink}`, "_blank");

  const menuResult = useViewMenuItems({
    isOwner,
    isAdmin,
    workspaceSlug,
    projectId,
    view,
    handleEdit: () => dialog.setOpen("edit"),
    handleDelete: () => dialog.setOpen("delete"),
    handleCopyLink: handleCopyText,
    handleOpenInNewTab,
  });

  // Handle both CE (array) and EE (object) return types
  const MENU_ITEMS: TContextMenuItem[] = Array.isArray(menuResult) ? menuResult : menuResult.items;
  const additionalModals = Array.isArray(menuResult) ? null : menuResult.modals;

  if (publishContextMenu) MENU_ITEMS.splice(2, 0, publishContextMenu);

  const CONTEXT_MENU_ITEMS = MENU_ITEMS.map(function CONTEXT_MENU_ITEMS(item) {
    return {
      ...item,
      action: () => {
        item.action();
      },
    };
  });

  return (
    <>
      {!props.dialog && (
        <ViewQuickActionDialogs projectId={projectId} view={view} workspaceSlug={workspaceSlug} dialog={dialog} />
      )}
      {additionalModals}
      <ContextMenu parentRef={parentRef} items={CONTEXT_MENU_ITEMS} />
      <Menu>
        <MenuTrigger
          render={
            <IconButton
              variant="tertiary"
              size="md"
              icon={<Icon icon={MoreHorizontalOutline} />}
              aria-label={t("aria_labels.common.more_actions")}
            />
          }
        />
        <MenuContent side="bottom" align="end">
          {getRenderableItems(MENU_ITEMS).map((item) => (
            <MenuItem
              key={item.key}
              variant={resolveItemVariant(item)}
              icon={item.icon ? <Icon icon={item.icon} /> : undefined}
              label={item.title ?? ""}
              description={item.description}
              disabled={item.disabled}
              onClick={() => {
                item.action();
              }}
            />
          ))}
        </MenuContent>
      </Menu>
    </>
  );
});
