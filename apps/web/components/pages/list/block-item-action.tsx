/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { GlobeOutline, HideOutline, InfoOutline, LockedOutline, MinusOutline } from "@makeplane/propel/icons";
// plane imports
import { Avatar } from "@makeplane/propel/components/avatar";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { FavoriteStar } from "@plane/blocks/common";
import { EPageAccess } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { renderFormattedDate, getFileURL } from "@plane/utils";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { usePageOperations } from "@/hooks/use-page-operations";
// plane web hooks
import type { EPageStoreType } from "@/hooks/store";
// store
import type { TPageInstance } from "@/store/pages/base-page";
// local imports
import { PageActions } from "../dropdowns";

type Props = {
  page: TPageInstance;
  parentRef: React.RefObject<HTMLElement | null>;
  storeType: EPageStoreType;
};

export const BlockItemAction = observer(function BlockItemAction(props: Props) {
  const { page, parentRef, storeType } = props;
  // plane hooks
  const { t } = useTranslation();
  // store hooks
  const { getUserDetails } = useMember();
  // page operations
  const { pageOperations } = usePageOperations({
    page,
  });
  // derived values
  const { access, created_at, is_favorite, is_locked, owned_by, canCurrentUserFavoritePage } = page;
  const isPublic = access === EPageAccess.PUBLIC;
  const ownerDetails = owned_by ? getUserDetails(owned_by) : undefined;

  return (
    <>
      {/* page details */}
      <div className="cursor-default">
        <Tooltip label={`Owned by: ${ownerDetails?.display_name ?? ""}`} layout="stacked">
          <Avatar
            alt={ownerDetails?.display_name}
            fallback={ownerDetails?.display_name?.[0]?.toUpperCase()}
            src={getFileURL(ownerDetails?.avatar_url ?? "")}
            size="xs"
          />
        </Tooltip>
      </div>
      {is_locked && (
        <div className="cursor-default text-tertiary">
          <Tooltip label={t("page_status.locked")}>
            <LockedOutline className="h-4 w-4" />
          </Tooltip>
        </div>
      )}
      <div className="cursor-default text-tertiary">
        <Tooltip label={t(isPublic ? "common.access.public" : "common.access.private")}>
          {isPublic ? <GlobeOutline className="h-4 w-4" /> : <HideOutline className="h-4 w-4" />}
        </Tooltip>
      </div>
      {/* vertical divider */}
      <MinusOutline className="-mx-3 h-5 w-5 rotate-90 text-placeholder" />

      {/* page info */}
      <Tooltip label={`Created on ${renderFormattedDate(created_at)}`} layout="stacked">
        <span className="grid h-4 w-4 cursor-default place-items-center">
          <InfoOutline className="h-4 w-4 text-tertiary" />
        </span>
      </Tooltip>

      {/* favorite/unfavorite */}
      {canCurrentUserFavoritePage && (
        <FavoriteStar
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            pageOperations.toggleFavorite();
          }}
          selected={is_favorite}
        />
      )}

      {/* quick actions dropdown */}
      <PageActions
        optionsOrder={[
          "open-in-new-tab",
          "copy-link",
          "add-sub-page",
          "move",
          "make-a-copy",
          "toggle-lock",
          "toggle-access",
          "archive-restore",
          "delete",
        ]}
        page={page}
        pageOperations={pageOperations}
        parentRef={parentRef}
        storeType={storeType}
      />
    </>
  );
});
