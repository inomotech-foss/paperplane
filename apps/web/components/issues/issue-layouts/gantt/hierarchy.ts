/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { buildIssueHierarchy } from "../spreadsheet/hierarchy";

/**
 * Which rows of the timeline are unfolded.
 *
 * `expandDepth` is how many levels show by default: `null` shows every level,
 * `1` only the top level ("collapse all"), `2` the top level and its children.
 * `overrides` holds the rows a person folded or unfolded by hand, which win over
 * the default until the next "expand all" / "collapse all".
 */
export type TGanttExpansion = {
  expandDepth: number | null;
  overrides: Record<string, boolean>;
};

export const DEFAULT_GANTT_EXPANSION: TGanttExpansion = { expandDepth: null, overrides: {} };

export type TGanttRow = {
  /** 0 for a top-level row. */
  depth: number;
  /** Children available to show: loaded with the view, or fetched when the row was unfolded. */
  childIds: string[];
  /** Unfolded by the expansion state; only has an effect once children are available. */
  isExpanded: boolean;
};

export type TGanttRows = {
  /** Rows to render, in order: each parent followed by its unfolded children, depth first. */
  visibleIds: string[];
  rows: Map<string, TGanttRow>;
  /** The number of levels among the available rows, for "show N levels". */
  levelCount: number;
};

export const isRowExpandedByDefault = (expansion: TGanttExpansion, depth: number) =>
  expansion.expandDepth === null || depth < expansion.expandDepth - 1;

/**
 * Order the timeline rows as a tree and drop the ones inside folded parents.
 *
 * `issueIds` is the view's ordered list; children that are part of it nest under
 * their parent, keeping the view's order among siblings. `getFetchedChildIds`
 * adds children loaded separately (when the view only lists top-level work
 * items), after the listed ones. A parent cycle never hides its members.
 */
export const buildGanttRows = (params: {
  issueIds: string[];
  getParentId: (issueId: string) => string | null | undefined;
  getFetchedChildIds?: (issueId: string) => string[] | undefined;
  expansion: TGanttExpansion;
}): TGanttRows => {
  const { issueIds, getParentId, getFetchedChildIds, expansion } = params;
  const { rootIds, childIdsByParentId } = buildIssueHierarchy(issueIds, getParentId);

  const rows = new Map<string, TGanttRow>();
  const visibleIds: string[] = [];
  let levelCount = 0;

  const childIdsOf = (issueId: string) => {
    const listed = childIdsByParentId.get(issueId) ?? [];
    const fetched = getFetchedChildIds?.(issueId);
    if (!fetched?.length) return listed;
    const listedSet = new Set(listed);
    return [...listed, ...fetched.filter((childId) => !listedSet.has(childId))];
  };

  // Iterative depth-first walk; `hidden` is true below a folded row, where rows
  // are still recorded (for the level count) but not rendered.
  const stack: { issueId: string; depth: number; hidden: boolean }[] = [];
  for (let index = rootIds.length - 1; index >= 0; index--)
    stack.push({ issueId: rootIds[index], depth: 0, hidden: false });
  while (stack.length > 0) {
    const { issueId, depth, hidden } = stack.pop()!;
    if (rows.has(issueId)) continue;
    const childIds = childIdsOf(issueId).filter((childId) => !rows.has(childId) && childId !== issueId);
    const isExpanded = expansion.overrides[issueId] ?? isRowExpandedByDefault(expansion, depth);
    rows.set(issueId, { depth, childIds, isExpanded });
    levelCount = Math.max(levelCount, depth + 1);
    if (!hidden) visibleIds.push(issueId);
    for (let index = childIds.length - 1; index >= 0; index--)
      stack.push({ issueId: childIds[index], depth: depth + 1, hidden: hidden || !isExpanded });
  }

  return { visibleIds, rows, levelCount };
};

/** Fold or unfold one row by hand. */
export const toggleGanttRow = (expansion: TGanttExpansion, issueId: string, isExpanded: boolean): TGanttExpansion => ({
  ...expansion,
  overrides: { ...expansion.overrides, [issueId]: !isExpanded },
});

/** Show `levels` levels everywhere (null: all), forgetting rows folded by hand. */
export const showGanttLevels = (levels: number | null): TGanttExpansion => ({ expandDepth: levels, overrides: {} });
