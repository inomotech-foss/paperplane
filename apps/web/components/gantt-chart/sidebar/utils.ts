/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ChartDataType, IBlockUpdateData, IGanttBlock } from "@plane/types";

/** The row a block is nested under; null or undefined for a top-level row. Flat lists omit it. */
export type TGetBlockParentId = (blockId: string) => string | null | undefined;

export type TSiblingDrop = {
  /** The dragged block's siblings in display order, without the dragged block. */
  siblingIds: string[];
  /** Where the dragged block goes in `siblingIds`. */
  index: number;
  /** Where the dragged block was among its siblings. */
  sourceIndex: number;
};

/**
 * Resolve a drop to a position among the dragged block's siblings.
 *
 * `blockIds` is the flattened list as rendered, each parent followed by its
 * subtree. The drop lands in the gap above `droppedBlockId`, or after the last
 * row. Returns undefined when the gap is not between two siblings of the
 * dragged block (no reparenting) or when the block would not move.
 */
export const getSiblingDrop = (params: {
  blockIds: string[];
  draggingBlockId: string;
  droppedBlockId: string;
  dropAtEndOfList: boolean;
  getParentId?: TGetBlockParentId;
}): TSiblingDrop | undefined => {
  const { blockIds, draggingBlockId, droppedBlockId, dropAtEndOfList, getParentId } = params;
  const parentOf = (blockId: string) => getParentId?.(blockId) ?? null;
  // the ancestor-or-self of a row that sits directly under `parentId`
  const findChildOf = (blockId: string, parentId: string | null) => {
    let currentId: string | null = blockId;
    for (let step = 0; currentId !== null && step <= blockIds.length; step++) {
      const currentParentId = parentOf(currentId);
      if (currentParentId === parentId) return currentId;
      currentId = currentParentId;
    }
    return undefined;
  };

  const gap = dropAtEndOfList ? blockIds.length : blockIds.indexOf(droppedBlockId);
  if (gap === -1 || !blockIds.includes(draggingBlockId)) return;

  const parentId = parentOf(draggingBlockId);
  const nextId = blockIds[gap] as string | undefined;
  const previousId = gap > 0 ? blockIds[gap - 1] : undefined;

  let anchor: { id: string; isAfter: boolean } | undefined;
  if (nextId !== undefined && parentOf(nextId) === parentId) anchor = { id: nextId, isAfter: false };
  else if (previousId !== undefined && (nextId === undefined || findChildOf(nextId, parentId) === undefined)) {
    // the gap closes the sibling group: land after the sibling whose subtree ends here
    const siblingId = findChildOf(previousId, parentId);
    if (siblingId !== undefined) anchor = { id: siblingId, isAfter: true };
  }
  if (!anchor || anchor.id === draggingBlockId) return;

  const groupIds = blockIds.filter((blockId) => parentOf(blockId) === parentId);
  const siblingIds = groupIds.filter((blockId) => blockId !== draggingBlockId);
  const index = siblingIds.indexOf(anchor.id) + (anchor.isAfter ? 1 : 0);
  const sourceIndex = groupIds.indexOf(draggingBlockId);
  if (index === sourceIndex) return;

  return { siblingIds, index, sourceIndex };
};

/** The sort order for a block placed at `index` among `siblingIds`. */
export const getSortOrderAt = (
  siblingIds: string[],
  index: number,
  getSortOrder: (blockId: string) => number
): number | undefined => {
  const previousId = index > 0 ? siblingIds[index - 1] : undefined;
  const nextId = siblingIds[index] as string | undefined;
  if (previousId === undefined && nextId === undefined) return;
  if (previousId === undefined) return getSortOrder(nextId!) - 1000;
  if (nextId === undefined) return getSortOrder(previousId) + 1000;
  return (getSortOrder(previousId) + getSortOrder(nextId)) / 2;
};

export const handleOrderChange = (
  draggingBlockId: string | undefined,
  droppedBlockId: string | undefined,
  dropAtEndOfList: boolean,
  blockIds: string[] | null,
  getBlockById: (id: string, currentViewData?: ChartDataType) => IGanttBlock,
  blockUpdateHandler: (block: any, payload: IBlockUpdateData) => void,
  getParentId?: TGetBlockParentId
) => {
  if (!blockIds || !draggingBlockId || !droppedBlockId) return;

  const drop = getSiblingDrop({ blockIds, draggingBlockId, droppedBlockId, dropAtEndOfList, getParentId });
  if (!drop) return;

  const newSortOrder = getSortOrderAt(drop.siblingIds, drop.index, (id) => getBlockById(id)?.sort_order ?? 0);
  if (newSortOrder === undefined) return;

  blockUpdateHandler(getBlockById(draggingBlockId)?.data, {
    sort_order: { destinationIndex: drop.index, newSortOrder, sourceIndex: drop.sourceIndex },
  });
};
