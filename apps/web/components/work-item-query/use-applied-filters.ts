// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
// plane imports
import { EIssueFilterType } from "@plane/constants";
import type { TClearFilterOptions } from "@plane/constants";
import type { EIssuesStoreType, IIssueFilters } from "@plane/types";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
import { usePqlDraft } from "@/lib/work-item-view-url/pql-draft";
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
 * Whether a list is narrowed by rich filters or a query, and ways to clear them. A query counts when it is
 * applied or shown as a draft from the URL. `entityId` is the id the store keys filters by: the project,
 * cycle, module or view id.
 */
export const useAppliedFilters = (storeType: EIssuesStoreType, entityId: string | undefined, filter?: RichFilter) => {
  const { workspaceSlug, projectId } = useParams();
  const { issuesFilter } = useIssues(storeType);
  const store = issuesFilter as unknown as QueryFilterStore;
  const draft = usePqlDraft();
  const hasQuery = (!!entityId && appliedQuery(store.getIssueFilters(entityId)).trim().length > 0) || !!draft;
  const hasRichFilters = !!filter?.hasActiveFilters;

  const clearQuery = useCallback(async () => {
    if (!hasQuery || !workspaceSlug || !entityId) return;
    await store.updateFilters(
      workspaceSlug.toString(),
      projectId?.toString(),
      EIssueFilterType.DISPLAY_FILTERS,
      { pql: "" },
      entityId
    );
  }, [hasQuery, workspaceSlug, projectId, entityId, store]);

  const clearAll = async () => {
    if (hasRichFilters) await filter?.clearFilters();
    await clearQuery();
  };

  return { hasFilters: hasQuery || hasRichFilters, clearAll, clearQuery };
};

/** For the filter bar: its Clear all clears the query too, applied or a draft. */
export const useClearQueryOptions = (
  storeType: EIssuesStoreType,
  entityId: string | undefined
): TClearFilterOptions => {
  const { clearQuery } = useAppliedFilters(storeType, entityId);
  return useMemo(() => ({ onFilterClear: clearQuery }), [clearQuery]);
};
