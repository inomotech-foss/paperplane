/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/** The data a tree-like drag source or drop target carries. */
export type TDragTargetData = {
  id: string | undefined;
  parentId: string | null | undefined;
  isGroup: boolean;
  isChild: boolean;
};

export const getDragDataId = (data: Record<string | symbol, unknown>): string | undefined =>
  typeof data.id === "string" ? data.id : undefined;

export const getDragTargetData = (data: Record<string | symbol, unknown>): TDragTargetData => ({
  id: getDragDataId(data),
  parentId: typeof data.parentId === "string" || data.parentId === null ? data.parentId : undefined,
  isGroup: Boolean(data.isGroup),
  isChild: Boolean(data.isChild),
});
