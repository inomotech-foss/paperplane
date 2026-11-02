/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { MoreHorizontalOutline } from "@makeplane/propel/icons";
// ui
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Icon } from "@makeplane/propel/components/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { setToast } from "@plane/blocks/toast";
import type { TContextMenuItem } from "@plane/blocks/context-menu";
import { ContextMenu, getRenderableItems, resolveItemVariant } from "@plane/blocks/context-menu";
import { copyUrlToClipboard } from "@plane/utils";
// hooks
import { useCycleMenuItems } from "@/components/common/quick-actions-helper";
import { useCycle } from "@/hooks/store/use-cycle";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { useMountOnOpen } from "@/hooks/use-mount-on-open";
import type { TRowDialog } from "@/hooks/use-row-dialog";
import { useRowDialog } from "@/hooks/use-row-dialog";
// local imports
import { ArchiveCycleModal } from "./archived-cycles/modal";
import { CycleDeleteModal } from "./delete-modal";
import { CycleCreateUpdateModal } from "./modal";

export type TCycleDialog = "edit" | "archive" | "delete";

type TDialogsProps = {
  cycleId: string;
  projectId: string;
  workspaceSlug: string;
  dialog: TRowDialog<TCycleDialog>;
};

/** The edit, archive and delete dialogs of a cycle. Each mounts the first time it opens. */
export const CycleQuickActionDialogs = observer(function CycleQuickActionDialogs(props: TDialogsProps) {
  const { cycleId, projectId, workspaceSlug, dialog } = props;
  const { getCycleById } = useCycle();
  const cycleDetails = getCycleById(cycleId);
  const showUpdateModal = useMountOnOpen(dialog.open === "edit");
  const showArchiveModal = useMountOnOpen(dialog.open === "archive");
  const showDeleteModal = useMountOnOpen(dialog.open === "delete");
  const handleClose = () => dialog.setOpen(null);

  if (!cycleDetails) return null;

  return (
    <div className="fixed">
      {showUpdateModal && (
        <CycleCreateUpdateModal
          data={cycleDetails}
          isOpen={dialog.open === "edit"}
          handleClose={handleClose}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
        />
      )}
      {showArchiveModal && (
        <ArchiveCycleModal
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          cycleId={cycleId}
          isOpen={dialog.open === "archive"}
          handleClose={handleClose}
        />
      )}
      {showDeleteModal && (
        <CycleDeleteModal
          cycle={cycleDetails}
          isOpen={dialog.open === "delete"}
          handleClose={handleClose}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
        />
      )}
    </div>
  );
});

type Props = {
  parentRef: React.RefObject<HTMLElement | null>;
  cycleId: string;
  projectId: string;
  workspaceSlug: string;
  customClassName?: string;
  /** Dialog state owned by the row. The row then renders `CycleQuickActionDialogs` itself. */
  dialog?: TRowDialog<TCycleDialog>;
};

export const CycleQuickActions = observer(function CycleQuickActions(props: Props) {
  const { parentRef, cycleId, projectId, workspaceSlug, customClassName } = props;
  // router
  const router = useAppRouter();
  // states
  const ownDialog = useRowDialog<TCycleDialog>();
  const dialog = props.dialog ?? ownDialog;
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const { getCycleById, restoreCycle } = useCycle();
  const { t } = useTranslation();
  // derived values
  const cycleDetails = getCycleById(cycleId);
  // auth
  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );

  const cycleLink = `${workspaceSlug}/projects/${projectId}/cycles/${cycleId}`;
  const handleCopyText = () =>
    copyUrlToClipboard(cycleLink).then(() => {
      setToast({
        type: "success",
        title: t("common.link_copied"),
        message: t("common.link_copied_to_clipboard"),
      });
    });
  const handleOpenInNewTab = () => window.open(`/${cycleLink}`, "_blank");

  const handleRestoreCycle = async () =>
    await restoreCycle(workspaceSlug, projectId, cycleId)
      .then(() => {
        setToast({
          type: "success",
          title: t("project_cycles.action.restore.success.title"),
          message: t("project_cycles.action.restore.success.description"),
        });
        router.push(`/${workspaceSlug}/projects/${projectId}/archives/cycles`);
      })
      .catch(() => {
        setToast({
          type: "error",
          title: t("project_cycles.action.restore.failed.title"),
          message: t("project_cycles.action.restore.failed.description"),
        });
      });

  const menuResult = useCycleMenuItems({
    cycleDetails: cycleDetails ?? undefined,
    workspaceSlug,
    projectId,
    cycleId,
    isEditingAllowed,
    handleEdit: () => dialog.setOpen("edit"),
    handleArchive: () => dialog.setOpen("archive"),
    handleRestore: handleRestoreCycle,
    handleDelete: () => dialog.setOpen("delete"),
    handleCopyLink: handleCopyText,
    handleOpenInNewTab,
  });

  const MENU_ITEMS: TContextMenuItem[] = Array.isArray(menuResult) ? menuResult : menuResult.items;
  const additionalModals = Array.isArray(menuResult) ? null : menuResult.modals;

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
        <CycleQuickActionDialogs
          cycleId={cycleId}
          projectId={projectId}
          workspaceSlug={workspaceSlug}
          dialog={dialog}
        />
      )}
      {additionalModals}
      <ContextMenu parentRef={parentRef} items={CONTEXT_MENU_ITEMS} />
      {/* propel: the trigger takes no className — the caller's box classes ride on the wrapper */}
      <span className={customClassName}>
        <Menu>
          <MenuTrigger
            render={
              <IconButton
                variant="tertiary"
                size="md"
                icon={<Icon icon={MoreHorizontalOutline} />}
                aria-label={t("common.options")}
                // the legacy menu root swallowed clicks so list rows / links around it never navigated
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") e.stopPropagation();
                }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  item.action();
                }}
              />
            ))}
          </MenuContent>
        </Menu>
      </span>
    </>
  );
});
