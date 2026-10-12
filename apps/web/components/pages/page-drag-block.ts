/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TPageDragBlock = "archived" | "no_permission" | "filtered";

type TDraggablePage = {
  archived_at?: string | null;
  canCurrentUserMovePage: boolean;
};

/** Why a page cannot be dragged, or undefined when it can. */
export const getPageDragBlock = (page: TDraggablePage | undefined, isFiltered: boolean): TPageDragBlock | undefined => {
  if (page?.archived_at) return "archived";
  if (!page?.canCurrentUserMovePage) return "no_permission";
  if (isFiltered) return "filtered";
  return undefined;
};

export const PAGE_DRAG_BLOCK_I18N_KEYS: Record<TPageDragBlock, string> = {
  archived: "page_list_tree.drag_blocked.archived",
  no_permission: "page_list_tree.drag_blocked.no_permission",
  filtered: "page_list_tree.drag_blocked.filtered",
};
