/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TIssues } from "@plane/types";

/** Returns the issue ids of a group, or of a sub group when `subGroupId` is set. */
export const getGroupIssueIds = (
  groupedIssueIds: TIssues | undefined,
  groupId: string,
  subGroupId?: string
): string[] => {
  const group = groupedIssueIds?.[groupId];
  if (subGroupId) return group && !Array.isArray(group) ? (group[subGroupId] ?? []) : [];
  return Array.isArray(group) ? group : [];
};
