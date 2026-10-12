/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TPagePlacement = {
  parentId: string | null;
  before?: string;
  after?: string;
};

type TReorderParams = {
  sourceId: string;
  targetId: string;
  position: "above" | "below";
  parentId: string | null;
  // the rendered row group of the target, which at the top level can hold pages whose parent is in another tab
  visibleSiblingIds: string[];
  getParentId: (pageId: string) => string | null;
};

/**
 * Anchors the drop to the nearest real sibling of `parentId`, so rows that only look
 * like siblings are never used as anchors.
 */
export const getReorderPlacement = (params: TReorderParams): TPagePlacement => {
  const { sourceId, targetId, position, parentId, visibleSiblingIds, getParentId } = params;
  const rowIds = visibleSiblingIds.filter((id) => id !== sourceId);
  const targetIndex = rowIds.indexOf(targetId);
  if (targetIndex < 0) return { parentId };
  const insertIndex = position === "above" ? targetIndex : targetIndex + 1;
  const isSibling = (id: string) => getParentId(id) === parentId;
  for (let index = insertIndex - 1; index >= 0; index--) {
    if (isSibling(rowIds[index])) return { parentId, after: rowIds[index] };
  }
  const before = rowIds.slice(insertIndex).find(isSibling);
  if (before) return { parentId, before };
  return { parentId };
};
