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
import { getInsertSortOrder, RENUMBER_SIBLINGS } from "@/store/pages/page-order";

type TPageDragData = {
  id: string;
  type: "PAGE";
};

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
  const {
    filters,
    getPageById,
    getPageAncestorIds,
    getChildPageIds,
    getPageTreeStructureByTab,
    expandPages,
    renumberSiblings,
  } = usePageStore(storeType);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !isEnabled) return;

    const isFiltered = () =>
      filters.searchQuery.trim().length > 0 || calculateTotalFilters(filters.filters ?? {}) !== 0;

    const getSiblingIds = (parentId: string | null, page: { archived_at?: string | null; access?: EPageAccess }) => {
      if (parentId) return getChildPageIds(parentId);
      const tab: TPageNavigationTabs = page.archived_at
        ? "archived"
        : page.access === EPageAccess.PRIVATE
          ? "private"
          : "public";
      return getPageTreeStructureByTab(tab).rootPageIds;
    };

    const handleDrop = async (source: TPageDragData, instruction: InstructionType | undefined) => {
      const sourcePage = getPageById(source.id);
      const page = getPageById(pageId);
      if (!sourcePage || !page || !instruction || instruction === "instruction-blocked") return;
      const newParentId = instruction === "make-child" ? pageId : (page.parent ?? null);
      // a page cannot become a child of itself or of one of its descendants
      if (newParentId === source.id) return;
      if (newParentId && getPageAncestorIds(newParentId).includes(source.id)) return;
      const isManualOrder = filters.sortKey === "sort_order" && filters.sortBy === "asc";
      const siblingIds = getSiblingIds(newParentId, page).filter((id) => id !== source.id);
      const targetIndex = siblingIds.indexOf(pageId);
      if (isManualOrder && instruction !== "make-child" && targetIndex < 0) return;
      const insertIndex =
        instruction === "make-child"
          ? siblingIds.length
          : instruction === "reorder-above"
            ? targetIndex
            : targetIndex + 1;
      try {
        if (!isManualOrder) {
          await sourcePage.changeParent(newParentId);
          if (newParentId) expandPages([newParentId]);
          return;
        }
        const sortOrder = getInsertSortOrder(
          siblingIds.map((id) => getPageById(id)?.sort_order ?? 0),
          insertIndex
        );
        if (sortOrder === RENUMBER_SIBLINGS) {
          const orderedIds = [...siblingIds];
          orderedIds.splice(insertIndex, 0, source.id);
          await renumberSiblings(newParentId, orderedIds);
        } else {
          await sourcePage.move({ parentId: newParentId, sortOrder });
        }
        if (newParentId) expandPages([newParentId]);
      } catch (_error) {
        setToast({
          type: "error",
          title: "Error!",
          message: "Page order could not be changed. Please try again later.",
        });
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
          const sourceData = source.data as Partial<TPageDragData>;
          if (isFiltered() || sourceData.type !== "PAGE" || !sourceData.id || sourceData.id === pageId) return false;
          // dropping a page onto its own descendant would create a cycle
          return !getPageAncestorIds(pageId).includes(sourceData.id);
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
    elementRef,
    expandPages,
    filters,
    getChildPageIds,
    getPageAncestorIds,
    getPageById,
    getPageTreeStructureByTab,
    hasChildPages,
    indentPerLevel,
    isDraggable,
    isEnabled,
    isExpanded,
    pageId,
    renumberSiblings,
  ]);

  return { isDragging, dropInstruction };
};
