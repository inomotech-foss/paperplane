/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { attachInstruction, extractInstruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item";
import { observer } from "mobx-react";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { PageIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// plane imports
import type { InstructionType } from "@plane/types";
import { DropIndicator } from "@plane/ui";
import { cn, getPageName } from "@plane/utils";
// components
import { ListItem } from "@/components/core/list";
import { BlockItemAction } from "@/components/pages/list/block-item-action";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
// plane web hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePage, usePageStore } from "@/hooks/store";

type TPageListBlock = {
  pageId: string;
  storeType: EPageStoreType;
  // tree view props
  depth?: number;
  hasChildPages?: boolean;
  isExpanded?: boolean;
  handleToggleExpanded?: () => void;
};

type TPageDragData = {
  id: string;
  type: "PAGE";
};

const TREE_INDENT_WIDTH = 20;

export const PageListBlock = observer(function PageListBlock(props: TPageListBlock) {
  const { pageId, storeType, depth, hasChildPages = false, isExpanded = false, handleToggleExpanded } = props;
  // refs
  const parentRef = useRef(null);
  const dndRef = useRef<HTMLDivElement | null>(null);
  // states
  const [isDragging, setIsDragging] = useState(false);
  const [dropInstruction, setDropInstruction] = useState<InstructionType | undefined>(undefined);
  // hooks
  const { t } = useTranslation();
  const page = usePage({
    pageId,
    storeType,
  });
  const { getPageById, getPageAncestorIds, expandPages } = usePageStore(storeType);
  const { isMobile } = usePlatformOS();
  // derived values
  const isTreeView = depth !== undefined;
  const isDraggable = isTreeView && !!page && !!page.canCurrentUserMovePage && !page.archived_at && !page.is_locked;

  useEffect(() => {
    const element = dndRef.current;
    if (!element || !isTreeView || !page) return;

    const handleDrop = async (source: TPageDragData, instruction: InstructionType | undefined) => {
      const sourcePage = getPageById(source.id);
      if (!sourcePage || !instruction || instruction === "instruction-blocked") return;
      const newParentId = instruction === "make-child" ? pageId : (page.parent ?? null);
      // a page cannot become a child of itself or of one of its descendants
      if (newParentId === source.id) return;
      if (newParentId && getPageAncestorIds(newParentId).includes(source.id)) return;
      try {
        await sourcePage.changeParent(newParentId);
        if (newParentId) expandPages([newParentId]);
      } catch (_error) {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "Error!",
          message: "Page could not be moved. Please try again later.",
        });
      }
    };

    return combine(
      draggable({
        element,
        canDrag: () => isDraggable,
        getInitialData: (): TPageDragData => ({ id: pageId, type: "PAGE" }),
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => {
          const sourceData = source.data as Partial<TPageDragData>;
          if (sourceData.type !== "PAGE" || !sourceData.id || sourceData.id === pageId) return false;
          // dropping a page onto its own descendant would create a cycle
          return !getPageAncestorIds(pageId).includes(sourceData.id);
        },
        getData: ({ input, element: targetElement }) =>
          attachInstruction(
            { id: pageId, type: "PAGE" },
            {
              input,
              element: targetElement,
              currentLevel: depth ?? 0,
              indentPerLevel: TREE_INDENT_WIDTH,
              // dropping right below an expanded row reads as dropping into its
              // children, so only offer reorder-above/make-child there
              mode: hasChildPages && isExpanded ? "expanded" : "standard",
            }
          ),
        onDrag: ({ self }) => setDropInstruction(extractInstruction(self.data)?.type),
        onDragLeave: () => setDropInstruction(undefined),
        onDrop: ({ self, source }) => {
          setDropInstruction(undefined);
          const instruction = extractInstruction(self.data)?.type;
          handleDrop(source.data as TPageDragData, instruction);
        },
      })
    );
  }, [
    depth,
    expandPages,
    getPageAncestorIds,
    getPageById,
    hasChildPages,
    isDraggable,
    isExpanded,
    isTreeView,
    page,
    pageId,
  ]);

  // handle page check
  if (!page) return null;
  // derived values
  const { name, logo_props, getRedirectionLink } = page;

  return (
    <div ref={dndRef} className={cn({ "opacity-50": isDragging })}>
      <DropIndicator isVisible={dropInstruction === "reorder-above"} />
      <ListItem
        prependTitleElement={
          <span className="flex items-center gap-1">
            {isTreeView && (
              <>
                {depth > 0 && <span aria-hidden className="flex-shrink-0" style={{ width: `${depth * 20}px` }} />}
                {hasChildPages ? (
                  <button
                    type="button"
                    className="grid size-5 flex-shrink-0 place-items-center rounded-sm text-tertiary transition-colors hover:bg-layer-1 hover:text-primary"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleToggleExpanded?.();
                    }}
                    aria-expanded={isExpanded}
                    aria-label={t(isExpanded ? "page_list_tree.collapse_button" : "page_list_tree.expand_button")}
                  >
                    <ChevronRight
                      className={cn("size-3.5 transition-transform duration-200", {
                        "rotate-90": isExpanded,
                      })}
                    />
                  </button>
                ) : (
                  <span aria-hidden className="size-5 flex-shrink-0" />
                )}
              </>
            )}
            {logo_props?.in_use ? (
              <Logo logo={logo_props} size={16} type="lucide" />
            ) : (
              <PageIcon className="h-4 w-4 text-tertiary" />
            )}
          </span>
        }
        title={getPageName(name)}
        itemLink={getRedirectionLink()}
        actionableItems={<BlockItemAction page={page} parentRef={parentRef} storeType={storeType} />}
        isMobile={isMobile}
        parentRef={parentRef}
        className={cn({
          "ring-accent-primary bg-layer-transparent-hover ring-1 ring-inset": dropInstruction === "make-child",
        })}
      />
      <DropIndicator isVisible={dropInstruction === "reorder-below"} />
    </div>
  );
});
