/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createContext, useContext } from "react";

export type TGanttRowState = {
  /** 0 for a top-level row. */
  depth: number;
  /** Whether the work item has children, loaded or not. */
  hasChildren: boolean;
  /** Children are showing below the row. */
  isExpanded: boolean;
  /** Children are being fetched after unfolding the row. */
  isLoading: boolean;
  /** How many work items are hidden below a folded row. */
  hiddenCount: number;
};

export type TGanttHierarchyContext = {
  getRowState: (issueId: string) => TGanttRowState | undefined;
  toggleRow: (issueId: string) => void;
};

/** Fold state of the work item timeline, read by the sidebar rows. */
export const GanttHierarchyContext = createContext<TGanttHierarchyContext | null>(null);

export const useGanttHierarchy = () => useContext(GanttHierarchyContext);
