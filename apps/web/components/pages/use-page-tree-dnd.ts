/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { attachInstruction, extractInstruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item";
import { EPageAccess } from "@plane/constants";
import { setToast } from "@plane/blocks/toast";
import type { InstructionType, TPageNavigationTabs } from "@plane/types";
import { calculateTotalFilters } from "@plane/utils";
// hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
// store
import { getReorderPlacement } from "@/store/pages/page-order";
import type { TPagePlacement } from "@/store/pages/page-order";

type TPageDragData = {
  id: string;
  type: "PAGE";
};

export const getPageDragId = (data: Record<string | symbol, unknown>): string | undefined =>
  data.type === "PAGE" && typeof data.id === "string" ? data.id : undefined;

export const showPageMoveError = () =>
  setToast({
    type: "error",
    title: "Error!",
    message: "Page order could not be changed. Please try again later.",
  });

const getPageTab = (page: { archived_at?: string | null; access?: EPageAccess }): TPageNavigationTabs =>
  page.archived_at ? "archived" : page.access === EPageAccess.PRIVATE ? "private" : "public";

type TUsePageTreeDnd = {
  elementRef: RefObject<HTMLElement | null>;
  pageId: string;
  storeType: EPageStoreType;
  depth: number;
  indentPerLevel: number;
  hasChildPages: boolean;
  isExpanded: boolean;
  isDraggable: boolean;
  isEnabled?: boolean;
};

export const usePageTreeDnd = (props: TUsePageTreeDnd) => {
  const {
    elementRef,
    pageId,
    storeType,
    depth,
    indentPerLevel,
    hasChildPages,
    isExpanded,
    isDraggable,
    isEnabled = true,
  } = props;
  // states
  const [isDragging, setIsDragging] = useState(false);
  const [dropInstruction, setDropInstruction] = useState<InstructionType | undefined>(undefined);
  // store hooks
  const { filters, getPageById, getPageAncestorIds, getPageTreeStructureByTab, expandPages, positionPage } =
    usePageStore(storeType);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !isEnabled) return;

    const isFiltered = () =>
      filters.searchQuery.trim().length > 0 || calculateTotalFilters(filters.filters ?? {}) !== 0;
    const isManualOrder = () => filters.sortKey === "sort_order" && filters.sortBy === "asc";

    const getPlacement = (sourceId: string, instruction: InstructionType): TPagePlacement | undefined => {
      const page = getPageById(pageId);
      if (!page) return undefined;
      if (instruction === "make-child") return { parentId: pageId };
      if (instruction !== "reorder-above" && instruction !== "reorder-below") return undefined;
      // top-level rows can have a parent in another tab, but the drop means the top level
      const parentId = depth === 0 ? null : (page.parent ?? null);
      const tree = getPageTreeStructureByTab(getPageTab(page));
      return getReorderPlacement({
        sourceId,
        targetId: pageId,
        position: instruction === "reorder-above" ? "above" : "below",
        parentId,
        visibleSiblingIds: parentId ? (tree.childPageIdsByParentId.get(parentId) ?? []) : tree.rootPageIds,
        getParentId: (id) => getPageById(id)?.parent ?? null,
      });
    };

    const handleDrop = async (sourceId: string, instruction: InstructionType | undefined) => {
      if (!instruction) return;
      const placement = getPlacement(sourceId, instruction);
      if (!placement) return;
      const { parentId } = placement;
      // a page cannot become a child of itself or of one of its descendants
      if (parentId === sourceId || (parentId && getPageAncestorIds(parentId).includes(sourceId))) return;
      try {
        await positionPage(sourceId, placement);
        if (parentId) expandPages([parentId]);
      } catch (_error) {
        showPageMoveError();
      }
    };

    return combine(
      draggable({
        element,
        canDrag: () => isDraggable && !isFiltered(),
        getInitialData: (): TPageDragData => ({ id: pageId, type: "PAGE" }),
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => {
          const sourceId = getPageDragId(source.data);
          if (isFiltered() || !sourceId || sourceId === pageId) return false;
          // dropping a page onto its own descendant would create a cycle
          return !getPageAncestorIds(pageId).includes(sourceId);
        },
        getData: ({ input, element: targetElement }) =>
          attachInstruction(
            { id: pageId, type: "PAGE" },
            {
              input,
              element: targetElement,
              currentLevel: depth,
              indentPerLevel,
              // dropping right below an expanded row reads as dropping into its
              // children, so only offer reorder-above/make-child there
              mode: hasChildPages && isExpanded ? "expanded" : "standard",
              // other sorts ignore sort_order, so only reparenting means anything there
              block: isManualOrder() ? [] : ["reorder-above", "reorder-below"],
            }
          ),
        onDrag: ({ self }) => setDropInstruction(extractInstruction(self.data)?.type),
        onDragLeave: () => setDropInstruction(undefined),
        onDrop: ({ self, source }) => {
          setDropInstruction(undefined);
          const sourceId = getPageDragId(source.data);
          if (sourceId) void handleDrop(sourceId, extractInstruction(self.data)?.type);
        },
      })
    );
  }, [
    depth,
    elementRef,
    expandPages,
    filters,
    getPageAncestorIds,
    getPageById,
    getPageTreeStructureByTab,
    hasChildPages,
    indentPerLevel,
    isDraggable,
    isEnabled,
    isExpanded,
    pageId,
    positionPage,
  ]);

  return { isDragging, dropInstruction };
};
