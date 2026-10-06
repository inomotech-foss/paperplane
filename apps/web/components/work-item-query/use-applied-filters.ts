// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useParams } from "next/navigation";
// plane imports
import { EIssueFilterType } from "@plane/constants";
import type { EIssuesStoreType, IIssueFilters } from "@plane/types";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
// local imports
import { appliedQuery } from "./utils";

// The part of the list filter stores this hook needs; the project store ignores the trailing id.
type QueryFilterStore = {
  getIssueFilters(entityId: string): IIssueFilters | undefined;
  updateFilters(
    workspaceSlug: string,
    projectId: string | undefined,
    type: EIssueFilterType,
    filters: { pql: string },
    entityId: string
  ): Promise<void>;
};

type RichFilter = { hasActiveFilters: boolean; clearFilters: () => Promise<void> } | undefined;

/**
 * Whether a list is narrowed by rich filters or an applied PQL query, and a way to clear both.
 * `entityId` is the id the store keys filters by: the project, cycle, module or view id.
 */
export const useAppliedFilters = (storeType: EIssuesStoreType, entityId: string | undefined, filter?: RichFilter) => {
  const { workspaceSlug, projectId } = useParams();
  const { issuesFilter } = useIssues(storeType);
  const store = issuesFilter as unknown as QueryFilterStore;
  const hasQuery = !!entityId && appliedQuery(store.getIssueFilters(entityId)).trim().length > 0;
  const hasRichFilters = !!filter?.hasActiveFilters;

  const clearAll = async () => {
    if (hasRichFilters) await filter?.clearFilters();
    if (hasQuery && workspaceSlug && entityId) {
      await store.updateFilters(
        workspaceSlug.toString(),
        projectId?.toString(),
        EIssueFilterType.DISPLAY_FILTERS,
        { pql: "" },
        entityId
      );
    }
  };

  return { hasFilters: hasQuery || hasRichFilters, clearAll };
};
