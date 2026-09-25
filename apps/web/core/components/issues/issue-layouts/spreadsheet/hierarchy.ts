/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TIssueHierarchy = {
  /** Work items whose parent is not among the loaded ones, in their original order. */
  rootIds: string[];
  /** Loaded children of each loaded work item, in their original order. */
  childIdsByParentId: Map<string, string[]>;
};

/**
 * Nest a flat, ordered list of work items under the parents that are in the
 * same list. A work item whose parent is not loaded (or has none) is a root,
 * so a query result of invoices stays flat while "everything below a
 * customer" comes back as the customer's tree.
 *
 * A parent cycle (only possible with corrupt data) never hides its members:
 * anything unreachable from the roots is promoted to a root.
 */
export const buildIssueHierarchy = (
  issueIds: string[],
  getParentId: (issueId: string) => string | null | undefined
): TIssueHierarchy => {
  const loaded = new Set(issueIds);
  const rootIds: string[] = [];
  const childIdsByParentId = new Map<string, string[]>();

  for (const issueId of issueIds) {
    const parentId = getParentId(issueId);
    if (parentId && loaded.has(parentId) && parentId !== issueId) {
      const siblings = childIdsByParentId.get(parentId);
      if (siblings) siblings.push(issueId);
      else childIdsByParentId.set(parentId, [issueId]);
    } else {
      rootIds.push(issueId);
    }
  }

  // Promote the members of parent cycles, which no root reaches.
  const reached = new Set<string>();
  const stack = [...rootIds];
  while (stack.length > 0) {
    const issueId = stack.pop() as string;
    if (reached.has(issueId)) continue;
    reached.add(issueId);
    const children = childIdsByParentId.get(issueId);
    if (children) stack.push(...children);
  }
  for (const issueId of issueIds) {
    if (reached.has(issueId)) continue;
    rootIds.push(issueId);
    // Its parent link is part of the cycle; drop it so it is not rendered twice.
    const parentId = getParentId(issueId);
    const siblings = parentId ? childIdsByParentId.get(parentId) : undefined;
    if (siblings) {
      const index = siblings.indexOf(issueId);
      if (index >= 0) siblings.splice(index, 1);
    }
    stack.push(issueId);
    while (stack.length > 0) {
      const current = stack.pop() as string;
      if (reached.has(current)) continue;
      reached.add(current);
      const children = childIdsByParentId.get(current);
      if (children) stack.push(...children);
    }
  }

  return { rootIds, childIdsByParentId };
};
