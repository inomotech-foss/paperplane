/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements, monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { cn } from "@plane/utils";
// hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
// local imports
import { getPageDragId, showPageMoveError } from "./use-page-tree-dnd";

type Props = {
  storeType: EPageStoreType;
  className?: string;
};

export const PageTreeRootDropZone = observer(function PageTreeRootDropZone(props: Props) {
  const { storeType, className } = props;
  // refs
  const ref = useRef<HTMLDivElement>(null);
  // states
  const [isPageDragActive, setIsPageDragActive] = useState(false);
  const [isOver, setIsOver] = useState(false);
  // plane hooks
  const { t } = useTranslation();
  // store hooks
  const { positionPage } = usePageStore(storeType);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return combine(
      monitorForElements({
        canMonitor: ({ source }) => !!getPageDragId(source.data),
        onDragStart: () => setIsPageDragActive(true),
        onDrop: () => setIsPageDragActive(false),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => !!getPageDragId(source.data),
        onDragEnter: () => setIsOver(true),
        onDragLeave: () => setIsOver(false),
        onDrop: ({ source }) => {
          setIsOver(false);
          const sourceId = getPageDragId(source.data);
          if (sourceId) positionPage(sourceId, { parentId: null }).catch(showPageMoveError);
        },
      })
    );
  }, [positionPage]);

  return (
    <div
      ref={ref}
      className={cn(
        "flex min-h-10 items-center justify-center rounded-sm border border-dashed border-subtle text-12 text-tertiary",
        {
          invisible: !isPageDragActive,
          "border-accent-strong bg-layer-transparent-hover text-primary": isOver,
        },
        className
      )}
    >
      {t("page_list_tree.move_to_top_level")}
    </div>
  );
});
