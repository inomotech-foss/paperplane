/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { GlobeOutline, LockOutline } from "@makeplane/propel/icons";
// plane imports
import { EUserPermissions, EUserPermissionsLevel, IS_FAVORITE_MENU_OPEN } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { IProjectView } from "@plane/types";
import { EViewAccess } from "@plane/types";
import { FavoriteStar } from "@plane/blocks/common";
import { getPublishViewLink } from "@plane/utils";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useProjectView } from "@/hooks/store/use-project-view";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import { ButtonAvatars } from "../dropdowns/member/avatar";
import type { TViewDialog } from "./quick-actions";
import { ViewQuickActions } from "./quick-actions";
import type { TRowDialog } from "@/hooks/use-row-dialog";

type Props = {
  parentRef: React.RefObject<HTMLElement | null>;
  view: IProjectView;
  /** The row renders its quick actions here on wider screens and next to the title otherwise. */
  showQuickActions: boolean;
  dialog: TRowDialog<TViewDialog>;
};

export const ViewListItemAction = observer(function ViewListItemAction(props: Props) {
  const { parentRef, view, showQuickActions, dialog } = props;
  // states
  const [_, setPublishModalOpen] = useState<boolean>(false);
  // router
  const { workspaceSlug, projectId } = useParams();
  // store
  const { allowPermissions } = useUserPermissions();

  const { addViewToFavorites, removeViewFromFavorites } = useProjectView();
  const { getUserDetails } = useMember();

  // local storage
  const { setValue: toggleFavoriteMenu, storedValue: isFavoriteOpen } = useLocalStorage<boolean>(
    IS_FAVORITE_MENU_OPEN,
    false
  );

  // derived values
  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  const access = view.access;

  const publishLink = getPublishViewLink(view?.anchor);

  // handlers
  const handleAddToFavorites = async () => {
    if (!workspaceSlug || !projectId) return;

    await addViewToFavorites(workspaceSlug.toString(), projectId.toString(), view.id);
    if (!isFavoriteOpen) toggleFavoriteMenu(true);
  };

  const handleRemoveFromFavorites = () => {
    if (!workspaceSlug || !projectId) return;

    removeViewFromFavorites(workspaceSlug.toString(), projectId.toString(), view.id);
  };

  const ownedByDetails = view.owned_by ? getUserDetails(view.owned_by) : undefined;

  return (
    <>
      <div className="cursor-default text-tertiary">
        <Tooltip label={access === EViewAccess.PUBLIC ? "Public" : "Private"}>
          {access === EViewAccess.PUBLIC ? <GlobeOutline className="h-4 w-4" /> : <LockOutline className="h-4 w-4" />}
        </Tooltip>
      </div>

      {view?.anchor && publishLink ? (
        // oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions
        <div
          className="flex cursor-pointer items-center gap-1.5 rounded-sm bg-success-subtle px-3 py-1.5 text-11 font-medium text-success-primary"
          onClick={() => setPublishModalOpen(true)}
        >
          <span className="size-1.5 flex-shrink-0 rounded-full bg-success-primary" />
          Live
        </div>
      ) : (
        <></>
      )}

      {/* created by */}
      {<ButtonAvatars showTooltip={false} userIds={ownedByDetails?.id ?? []} />}

      {isEditingAllowed && (
        <FavoriteStar
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (view.is_favorite) handleRemoveFromFavorites();
            else handleAddToFavorites();
          }}
          selected={!!view.is_favorite}
        />
      )}
      {showQuickActions && projectId && workspaceSlug && (
        <ViewQuickActions
          parentRef={parentRef}
          projectId={projectId.toString()}
          view={view}
          workspaceSlug={workspaceSlug.toString()}
          dialog={dialog}
        />
      )}
    </>
  );
});
