// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { TIssue } from "@plane/types";

/** A work item without a type has its project's default type. */
export const getEffectiveTypeId = (
  typeId: string | null | undefined,
  projectDefaultTypeId: string | null | undefined
): string | null => typeId || projectDefaultTypeId || null;

/** The unarchived work items of a project that have the given type. */
export const getWorkItemsOfType = <T extends Pick<TIssue, "project_id" | "type_id" | "archived_at">>(
  workItems: T[],
  projectId: string,
  typeId: string,
  projectDefaultTypeId: string | null | undefined
): T[] =>
  workItems.filter(
    (workItem) =>
      workItem.project_id === projectId &&
      !workItem.archived_at &&
      getEffectiveTypeId(workItem.type_id, projectDefaultTypeId) === typeId
  );
