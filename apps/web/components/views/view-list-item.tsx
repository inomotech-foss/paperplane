/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import { ViewsOutline } from "@makeplane/propel/icons";
// types
import type { IProjectView } from "@plane/types";
// components
import { ListItem } from "@/components/core/list";
// hooks
import { MD_UP, useMediaQuery } from "@/hooks/use-media-query";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { useRowDialog } from "@/hooks/use-row-dialog";
// local imports
import type { TViewDialog } from "./quick-actions";
import { ViewQuickActionDialogs, ViewQuickActions } from "./quick-actions";
import { ViewListItemAction } from "./view-list-item-action";

type Props = {
  view: IProjectView;
};

export const ProjectViewListItem = observer(function ProjectViewListItem(props: Props) {
  const { view } = props;
  // refs
  const parentRef = useRef(null);
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { isMobile } = usePlatformOS();
  const isMdUp = useMediaQuery(MD_UP);
  const dialog = useRowDialog<TViewDialog>();

  return (
    <>
      <ViewQuickActionDialogs
        projectId={projectId.toString()}
        view={view}
        workspaceSlug={workspaceSlug.toString()}
        dialog={dialog}
      />
      <ListItem
        prependTitleElement={
          <>
            {view?.logo_props?.in_use ? (
              <Logo logo={view?.logo_props} size={16} type="lucide" />
            ) : (
              <ViewsOutline className="h-4 w-4 text-tertiary" />
            )}
          </>
        }
        title={view.name}
        itemLink={`/${workspaceSlug}/projects/${projectId}/views/${view.id}`}
        actionableItems={
          <ViewListItemAction parentRef={parentRef} view={view} showQuickActions={isMdUp} dialog={dialog} />
        }
        quickActionElement={
          !isMdUp && (
            <ViewQuickActions
              parentRef={parentRef}
              projectId={projectId.toString()}
              view={view}
              workspaceSlug={workspaceSlug.toString()}
              dialog={dialog}
            />
          )
        }
        isMobile={isMobile}
        parentRef={parentRef}
      />
    </>
  );
});
